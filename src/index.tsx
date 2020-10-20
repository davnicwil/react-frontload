import React from 'react'

const IS_SERVER =
  typeof window === 'undefined' ||
  !window.document ||
  !window.document.createElement

type FrontloadMeta = {
  serverRendered: boolean
  pending: boolean
  done: boolean
  error: any
}

export type FrontloadProps<T> = {
  data: T
  frontloadMeta: FrontloadMeta
  setData: (fn: (data: T) => T) => void
}

type FrontloadServerRenderFunction<T> = (args: { isFinalRender?: boolean }) => T

type FrontloadFunction = (context: any) => Promise<any>
type FrontloadData = { key: string; fn: FrontloadFunction }

// util to obscure log calls from minification
const _log = ('l' + 'o' + 'g' + 'a').substring(0, 3)
const log = (...args: any[]) => {
  // @ts-ignore
  console[_log](...args)
}

const runAllFrontloads = async (frontloads: FrontloadData[], context: any) => {
  // run all frontload fns
  // if there are any errors, don't throw them, collect them
  //
  // note rather than a separate data structure for errors, just keep things
  // simple by collecting them as regular data with an obscure variable name
  // that won't clash with anything
  const data = await Promise.all(
    frontloads.map(({ fn }) =>
      fn(context)['catch']((error) => ({
        _____FRONTLOAD_____isServerRenderError: true,
        error,
      })),
    ),
  )

  return data.map((data, i) => ({ key: frontloads[i].key, data }))
}

export const createFrontloadState = {
  server: (args: { context: any; logging?: boolean }): FrontloadState =>
    new FrontloadStatePrivate(args),

  client: (args: {
    serverRenderedData: any
    context: any
    logging?: boolean
  }): FrontloadState => new FrontloadStatePrivate(args),
}

export type FrontloadState = InstanceType<typeof FrontloadStatePrivate>

class FrontloadStatePrivate {
  private serverRender: {
    pass: number
    frontloads: FrontloadData[][]
    cache: { [key: string]: any }
  } = {
    pass: -1,
    frontloads: [],
    cache: {},
  }

  private clientRender: {
    isFirstRender: boolean
    logging: boolean
  } = {
    isFirstRender: true,
    logging: false,
  }

  // injected into frontload functions
  public context: any

  constructor({
    serverRenderedData = {},
    context,
    logging,
  }: {
    serverRenderedData?: object
    context: any
    logging?: boolean
  }) {
    this.serverRender.cache = serverRenderedData
    this.context = context
    this.clientRender.logging = !!logging
  }

  public setFirstRenderDoneOnClient() {
    this.clientRender.isFirstRender = false

    // not required after first render
    // (all data now loaded into component state)
    // so remove it from memory
    this.serverRender.cache = {}
  }

  public isFirstRender() {
    return this.clientRender.isFirstRender
  }

  public isClientLoggingEnabled() {
    return this.clientRender.logging
  }

  public prepareServerRenderPass() {
    this.serverRender.pass++
    this.serverRender.frontloads.push([])
  }

  public collectServerRenderFrontload(frontload: FrontloadData) {
    this.serverRender.frontloads[this.serverRender.pass].push(frontload)
  }

  public hasFrontloadRunOnServer(key: string) {
    return this.serverRender.cache.hasOwnProperty(key)
  }

  public getFrontloadServerRenderedData(key: string) {
    return this.serverRender.cache[key]
  }

  public getServerRenderMeta() {
    return {
      numPasses: this.serverRender.pass + 1,
      frontloads: Object.keys(this.serverRender.cache),
    }
  }

  public getServerRenderCache() {
    return { ...this.serverRender.cache }
  }

  public async runFrontloadsForThisServerRenderPass() {
    const pass = this.serverRender.pass + 0
    const allFrontloads = this.serverRender.frontloads[pass]
    const alreadySeenInCurrentPass: { [key: string]: boolean } = {}
    const newFrontloads: FrontloadData[] = []
    const duplicateFrontloads: { [key: string]: number } = {}
    const cachedFrontloads: { [key: string]: boolean } = {}
    const errorCachedFrontloads: { [key: string]: boolean } = {}

    // take all frontloads collected in a render pass and reduce them to
    //
    // new ones not seen before
    // cached ones from previous passes
    // duplicate ones this pass
    //
    // note that this is based on the assumption that the same frontload key
    // should resolve the exact same data within a single server render cycle.
    //
    // It's up to the user to make sure this assumption holds.
    allFrontloads.forEach((frontload) => {
      if (frontload.key in this.serverRender.cache) {
        cachedFrontloads[frontload.key] = true

        // prettier-ignore
        if (this.serverRender.cache[frontload.key]?._____FRONTLOAD_____isServerRenderError) {
          errorCachedFrontloads[frontload.key] = true
        }
      } else if (alreadySeenInCurrentPass[frontload.key]) {
        duplicateFrontloads[frontload.key]++
      } else {
        alreadySeenInCurrentPass[frontload.key] = true
        newFrontloads.push(frontload)
      }
    })

    // to collect errors for logging
    //
    // note we always log errors in real time,
    // regardless of whether logging is set true or not
    const errors: { [key: string]: any } = {}

    // run all new frontloads and cache results
    const data = await runAllFrontloads(newFrontloads, this.context)
    data.forEach(({ key, data }) => {
      if (data?._____FRONTLOAD_____isServerRenderError) {
        errors[key] = data.error
        this.serverRender.cache[key] = {
          _____FRONTLOAD_____isServerRenderError: true,
        }
      } else {
        this.serverRender.cache[key] = data
      }
    })

    return {
      pass,
      allFrontloads,
      newFrontloads,
      duplicateFrontloads,
      cachedFrontloads,
      errorCachedFrontloads,
      errors,
    }
  }
}

const FrontloadContext = React.createContext<FrontloadState | null>(null)

export const FrontloadProvider = ({
  initialState: frontloadState,
  children,
}: {
  initialState: FrontloadState
  children: any
}) => {
  // on client only, when first render is done set that on the state and also
  // clear the server rendered cache as it won't be needed any more
  //
  // note that because we mutate the object in context directly, a rerender is
  // not triggered at the consumers. This is purposeful.
  React.useEffect(() => {
    frontloadState.setFirstRenderDoneOnClient()
  }, [])

  return (
    <FrontloadContext.Provider value={frontloadState}>
      {children}
    </FrontloadContext.Provider>
  )
}

const LOG_MESSAGE_LINE = '___________________________________\n'

const spaces = (length: number) => Array(length + 1).join(' ')

const padRight = (str: string, length: number) => {
  const buffer = spaces(length)

  return (str + buffer).substring(0, buffer.length)
}

export async function frontloadServerRender<T>({
  render,
  frontloadState,
}: {
  render: FrontloadServerRenderFunction<T>
  frontloadState: FrontloadState
}) {
  const logging = frontloadState.isClientLoggingEnabled()

  try {
    const { rendered, data, logMessage } = await _frontloadServerRender<T>(
      render,
      frontloadState,
      logging,
      '',

      // if the finalRenderPass argument needs to be injected into render()
      // the only way to do this is to run an extra render pass
      // when we are sure there are no more frontloads left to run
      //
      // obviously this is less efficient, so we should only do it when we need to
      // render.arguments.length === 0 ? undefined : false,
      // TODO fix issue with calling this in strict mode
      false,
    )

    if (logging) {
      log(logMessage)
    }

    return {
      rendered,
      data,
    }
  } catch (err) {
    // if there is an error, log before rethrowing if logging enabled
    if (logging) {
      console.log(
        `${LOG_MESSAGE_LINE}react-frontload server render trace\n\n` +
          `Error thrown during server render:\n\n`,
        err,
      )
      console.log('\n\n')
    }

    throw err
  }
}

async function _frontloadServerRender<T>(
  render: FrontloadServerRenderFunction<T>,
  frontloadState: FrontloadState,
  logging: boolean,
  logMessage: string,
  isFinalRender: boolean | undefined,
): Promise<{
  rendered: T
  data: { [key: string]: any }
  logMessage: string | undefined
}> {
  frontloadState.prepareServerRenderPass()

  const rendered: T = render({ isFinalRender })
  const renderPassResult = await frontloadState.runFrontloadsForThisServerRenderPass()

  // if any errors eere thrown, log their stacktraces regardless of whether
  // logging is enabled
  Object.keys(renderPassResult.errors).forEach((key) => {
    console.error(`\n[react-frontload] Error on frontload [${key}], render pass ${renderPassResult.pass}\n\n`, renderPassResult.errors[key], '\n' ) // prettier-ignore
  })

  // if logging enabled, log this render pass
  if (logging) {
    // log meta of all render passes except the final one if applicable
    // the final render pass being an extra pass is just an implementation
    // detail that shouldn't affect debugging or understanding of what ran
    // anyway, no frontloads will run in it, all data will already be cached

    if (isFinalRender) {
      // prettier-ignore
      logMessage +=
        `\n∙ Render pass ${renderPassResult.pass}\n` +
        `  - final render pass, no frontloads ran\n`
    } else {
      const seen: { [key: string]: boolean } = {}
      const renderPassMessage = `Render pass ${renderPassResult.pass}`
      const longest = Math.max(...renderPassResult.allFrontloads.map(({ key }) => key.length), renderPassMessage.length - 2) + 2 // prettier-ignore
      logMessage += `\n∙ ${padRight(renderPassMessage, longest)}  |  ${renderPassResult.allFrontloads.length} total, ${renderPassResult.newFrontloads.length} new\n` // prettier-ignore
      renderPassResult.allFrontloads.forEach(({ key }) => {
        // prettier-ignore
        let type = 'new'

        if (renderPassResult.duplicateFrontloads[key] && seen[key]) {
          type = 'duplicate'
        } else if (renderPassResult.cachedFrontloads[key]) {
          type = renderPassResult.errorCachedFrontloads[key]
            ? 'error in previous pass'
            : 'cached'
        } else if (renderPassResult.errors[key] !== undefined) {
          type = 'error'
        }

        logMessage += `  - ${padRight(key, longest)}|  ${type}\n`
        seen[key] = true
      })
    }
  }

  // if we ran any frontloads this render pass, new data has been loaded
  // which may mean that more frontload components render conditionally
  // on next render pass. We must run another render pass to find out -
  // to do so just rerun this function with exactly the same arguments
  if (renderPassResult.newFrontloads.length > 0) {
    return _frontloadServerRender(
      render,
      frontloadState,
      logging,
      logMessage,
      isFinalRender,
    )
  }

  // but, if isFinalRenderPass is defined and equal to false, this means we
  // must now run the extra final render pass
  if (isFinalRender === false) {
    return _frontloadServerRender(
      render,
      frontloadState,
      logging,
      logMessage,
      true, // set isFinalRenderPass to true
    )
  }

  if (logging) {
    const serverRenderMeta = frontloadState.getServerRenderMeta()

    // prettier-ignore
    logMessage =
      `${LOG_MESSAGE_LINE}react-frontload server render trace\n\n` +
      `${serverRenderMeta.frontloads.length} frontloads ran in ${serverRenderMeta.numPasses} render passes\n` +
           serverRenderMeta.frontloads.map(key => `  - ${key}`).join('\n') + '\n' +
      logMessage +
      LOG_MESSAGE_LINE
  }

  // if we get here, all render passes are done, there are no more frontloads
  // to run and we can return the result of the final one
  return {
    data: frontloadState.getServerRenderCache(),
    rendered,
    logMessage,
  }
}

const clientLogPrefix = '[react-frontload]'

export function useFrontload<T>(
  key: string,
  fn: (context: any) => Promise<T>,
): FrontloadProps<T> {
  const frontloadState = React.useContext(FrontloadContext)!
  const serverRendered = frontloadState.isFirstRender()
  const pendingInitial = serverRendered
    ? !frontloadState.hasFrontloadRunOnServer(key)
    : true
  const data = serverRendered
    ? frontloadState.getFrontloadServerRenderedData(key)
    : undefined
  const error = !!data?._____FRONTLOAD_____isServerRenderError

  const [state, setState] = React.useState<{
    data: T
    frontloadMeta: FrontloadMeta
  }>({
    data,
    frontloadMeta: {
      serverRendered,
      pending: pendingInitial,
      done: !pendingInitial,
      error,
    },
  })

  // on client run frontloads immediately as they are rendered
  // with useEffect to guarantee it only runs once on mount
  // it's fine to also run this code on the server, because there useEffect
  // just does nothing. In fact we need to, because you can't have hooks
  // behind conditionals without warnings from React
  React.useEffect(() => {
    if (state.frontloadMeta.serverRendered) {
      if (frontloadState.isClientLoggingEnabled()) log(`${clientLogPrefix} ${key} | server rendered`) // prettier-ignore
    } else {
      let start = 0
      if (frontloadState.isClientLoggingEnabled()) {
        log(`${clientLogPrefix} component [${key}] - running frontload`)
        start = Date.now()
      }

      fn(frontloadState.context)
        .then((data: T) => {
          if (frontloadState.isClientLoggingEnabled()) log(`${clientLogPrefix} ${key} | frontload ran in ${Date.now() - start}ms`) // prettier-ignore

          setState({
            ...state,
            data,
            frontloadMeta: {
              ...state.frontloadMeta,
              pending: false,
              done: true,
            },
          })
        })
        .catch((error: Error) => {
          if (frontloadState.isClientLoggingEnabled()) log(`${clientLogPrefix} ${key} | frontload errored in ${Date.now() - start}ms`) // prettier-ignore

          setState({
            ...state,
            frontloadMeta: {
              ...state.frontloadMeta,
              pending: false,
              done: true,
              error,
            },
          })
        })
    }
  }, []) // [] to only run once on mount

  if (IS_SERVER) {
    // on server just collect frontloads for running at end of each render pass
    frontloadState.collectServerRenderFrontload({ key, fn })
  }

  return {
    ...state,
    setData: (fn: (data: T) => T) => {
      setState((state) => ({
        ...state,
        data: fn(state.data),
      }))
    },
  }
}
