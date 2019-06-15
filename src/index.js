import React from 'react'
import PropTypes from 'prop-types'

const autoDetectIsServer = () =>
  typeof window === 'undefined' ||
  !window.document ||
  !window.document.createElement

const IS_SERVER = autoDetectIsServer()

let SERVER_FRONTLOAD_QUEUE = []

const LIFECYCLE_PHASES = {
  MOUNT: 0,
  UPDATE: 1,
}

const log =
  process.env.NODE_ENV !== 'production' &&
  ((name, message, ...args) => {
    console.log(
      `[react-frontload]${name ? ` [${name}]` : ''} ${message}`,
      ...args,
    )
  })

const map = (arr, fn) => {
  const mapped = []

  for (let i = 0; i < arr.length; i++) {
    mapped.push(fn(arr[i], i))
  }

  return mapped
}

// util with same behaviour of Promise.all, except it does not short-circuit
// to catch if one of the promises rejects. It resolves when all the passed promises
// have either resolved or rejected
function waitForAllToComplete(
  promises,
  { withLogging, continueRenderingOnError },
) {
  let firstError

  return Promise.all(
    map(promises, (promise) =>
      promise['catch']((error) => {
        if (!firstError) {
          firstError = error
        }

        if (withLogging) {
          log('frontloadServerRender info', `ERROR:`, error)
        }

        return error
      }),
    ),
  ).then(() => {
    if (continueRenderingOnError !== true && firstError) {
      throw firstError
    }
  })
}

export class Frontload extends React.Component {
  static childContextTypes = {
    frontload: PropTypes.object,
  }

  getChildContext() {
    return {
      frontload: {
        isServer: this.isServer,
        firstClientRenderDone: this.isServer
          ? true
          : this.firstClientRenderDone,
        // this does the work of either executing the frontload function on the client,
        // or pushing it to the queue for eventual execution on the server
        pushFrontload: (
          frontload,
          options,
          lifecylePhase,
          childProps,
          logMessage,
        ) => {
          const isMount = lifecylePhase === LIFECYCLE_PHASES.MOUNT
          const isUpdate = lifecylePhase === LIFECYCLE_PHASES.UPDATE
          const noServerRender =
            this.props.noServerRender || options.noServerRender

          // if on server, and noServerRender is configured globally or locally
          // or if the frontload is configured not to run for this lifecycle phase
          // just do nothing
          if (
            (this.isServer && noServerRender) ||
            (isMount && options.onMount === false) || // onMount default true
            (isUpdate && !options.onUpdate) // onUpdate default false
          ) {
            return
          }

          // if on server, don't execute the frontload immediately,
          // add it to the global queue so it can be executed
          // after the entire render pass is complete
          if (this.isServer) {
            SERVER_FRONTLOAD_QUEUE.unshift({
              fn: () => frontload(childProps, { isMount, isUpdate }),
              options,
              componentDisplayName: childProps.displayName,
            })

            if (
              process.env.NODE_ENV !== 'production' &&
              this.props.withLogging &&
              logMessage
            ) {
              log(this.props.name, `added frontload fn to queue ${logMessage}`)
            }
            // if on client, just execute the frontload immediately,
            // (but NOT on first ever client render, if server rendering is enabled)
          } else if (noServerRender || this.firstClientRenderDone) {
            frontload(childProps, { isMount, isUpdate })

            if (
              process.env.NODE_ENV !== 'production' &&
              this.props.withLogging &&
              logMessage
            ) {
              log(this.props.name, `executed frontload fn ${logMessage}`)
            }
            // log when frontload is not run on client first render because of server rendering
          } else if (
            process.env.NODE_ENV !== 'production' &&
            this.props.withLogging &&
            logMessage
          ) {
            log(
              this.props.name,
              `did not execute frontload fn on first client render ${logMessage}, since server rendering is enabled`,
            )
          }
        },
      },
    }
  }

  constructor(props, context) {
    super(props, context)

    this.isServer = props.isServer === undefined ? IS_SERVER : props.isServer

    // hook for first ever render on client
    // by default, no frontloads are run on first render, because it is assumed that server rendering is being used
    // to run all frontloads and fetch data on the server, such that fresh data is available for this first client
    // render. However, this setup may not be appropriate for every app. We may want to rerun the frontload
    // functions on the first render on the client for certain, or all, components, for example if server
    // rendering is not set up at all, or if data may be stale at the time of first client render due to
    // server-side caching. There are 2 options to configure rerunning the frontload fn(s)
    // on first render - in a per-frontload option { noServerRender: true }, or in a prop on this
    // Frontload provider: { noServerRender: true }, which of course enables this for all frontload fns
    this.componentDidMount = () => {
      this.firstClientRenderDone = true

      if (
        process.env.NODE_ENV !== 'production' &&
        props.withLogging &&
        !props.noServerRender
      ) {
        log(
          props.name,
          '1st client render done, from now on all frontloads will run',
        )
      }
    }
  }

  render() {
    return React.Children.only(this.props.children)
  }
}

class FrontloadConnectedComponent extends React.Component {
  static contextTypes = {
    frontload: PropTypes.object,
  }

  constructor(props, context) {
    super(props, context)

    if (context.frontload.isServer) {
      this.componentWillMount = this.pushFrontload(LIFECYCLE_PHASES.MOUNT)
    } else {
      this.componentDidMount = this.pushFrontload(LIFECYCLE_PHASES.MOUNT)
      this.componentDidUpdate = this.pushFrontload(LIFECYCLE_PHASES.UPDATE)
    }
  }

  pushFrontload = (lifecyclePhase) => (prevProps) => {
    if (lifecyclePhase === LIFECYCLE_PHASES.UPDATE) {
      const { _experimental_updateFunc } = this.props.options
      if (
        _experimental_updateFunc &&
        !_experimental_updateFunc(
          prevProps.componentProps,
          this.props.componentProps,
        )
      ) {
        return
      }
    }

    const logMessage =
      process.env.NODE_ENV !== 'production'
        ? null
        : `for component: [${this.props.component.displayName ||
            'anonymous'}] on [${
            lifecyclePhase === LIFECYCLE_PHASES.MOUNT ? 'mount' : 'update'
          }]`

    this.context.frontload.pushFrontload(
      this.props.frontload,
      this.props.options,
      lifecyclePhase,
      this.props.componentProps,
      logMessage,
    )
  }

  render() {
    return <this.props.component {...this.props.componentProps} />
  }
}

export const frontloadConnect = (frontload, options = {}) => (component) => (
  props,
) => (
  <FrontloadConnectedComponent
    frontload={frontload}
    component={component}
    componentProps={props}
    options={options}
  />
)

function dryRunRender(renderFunction) {
  // pass dryRun as true - the output is just thrown away as this is a dry run
  renderFunction(true)

  // all frontloads for the render pass have been collected in SERVER_FRONTLOAD_QUEUE
  // copy the frontloads to a local array then rest the global one ready
  // to collect frontloads from the next render pass
  const frontloadsFromRender = SERVER_FRONTLOAD_QUEUE
  SERVER_FRONTLOAD_QUEUE = []

  return frontloadsFromRender
}

function runAllFrontloads(frontloads, options) {
  return waitForAllToComplete(
    map(frontloads, (frontload) => frontload.fn()),
    options,
  )
}

function finalRender(renderFunction) {
  // pass dryRun as false
  const renderOutput = renderFunction(false)

  // just throw away the collected frontloads on the final render, don't run them
  // we're only interested in the rendered output as no further renders will be run
  // so there is no point in running the frontloads
  SERVER_FRONTLOAD_QUEUE = []

  return renderOutput
}

function frontloadServerRenderWorker(
  render,
  { withLogging, maxNestedFrontloadComponents, continueRenderingOnError },
  renderNumber = 1,
  frontloadsInLastRender = 0,
) {
  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log('frontloadServerRender info', `running render pass ${renderNumber}`)
  }

  // do a dry run render pass
  const frontloadsFromRender = dryRunRender(render)

  // count the newly collected frontloads from this render pass
  const frontloadsInThisRender = frontloadsFromRender.length + 0
  const newFrontloadsInThisRender =
    frontloadsInThisRender - frontloadsInLastRender

  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log(
      'frontloadServerRender info',
      `render pass ${renderNumber} - total frontloads count ${newFrontloadsInThisRender}`,
    )
  }

  // if there are no new frontloads from this render pass then we are done, and need to render and return the final output
  if (!newFrontloadsInThisRender) {
    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log(
        'frontloadServerRender info',
        `after running ${renderNumber} render passes (of max ${maxNestedFrontloadComponents} allowed) no frontload components remain to render, so running final render.`,
      )
    }

    const finalRenderOutput = finalRender(render)

    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log(
        'frontloadServerRender info',
        'NOTE: as the logs show, the queue(s) are filled by Frontload on final render, however they are NOT flushed, so the frontload functions DO NOT run unnecessarily on final render.',
      )
      log(
        'frontloadServerRender info',
        'final render succeeded. Server rendering is done.',
      )
    }

    // the return value of this function has to be a Promise
    return Promise.resolve(finalRenderOutput)
  }

  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log(
      'frontloadServerRender info',
      `${frontloadsInThisRender} frontloads (${newFrontloadsInThisRender} new) to run in render pass ${renderNumber}`,
    )
  }

  const startRunAllFrontloadsAt = withLogging && Date.now()

  // if there are new frontloads from this render pass, run them all, then do another render pass
  return runAllFrontloads(frontloadsFromRender, {
    withLogging,
    continueRenderingOnError,
  }).then(() => {
    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log(
        'frontloadServerRender info',
        `render pass ${renderNumber} - ran ${frontloadsInThisRender} frontloads (${newFrontloadsInThisRender} new) in ${Date.now() -
          startRunAllFrontloadsAt}ms`,
      )
    }

    // if we have reached the maximum configured number of render passes
    // i.e. the maximum allowed depth of nested frontloaded Components that can be server rendered
    // then we must exit the recrusion at this point
    // this means flushing those promises we have left, and then doing a final render
    //
    // If when doing the final render we detect more promises collected, i.e. more frontloads to run,
    // give a really detailed WARNING message so the (likely) bug can be properly understood and fixed
    if (renderNumber === maxNestedFrontloadComponents) {
      // pass the dry-run flag with value false to indicate to the render function that this IS the final render
      // note that queus were alrewady cleaned by the flushQueues() call
      const incompleteRenderOutput = render(false)

      // count if there are any incomplete frontloads left to run, we know this from if the collected
      // promises from the final render pass is greater than the collected promises we just flushed from the queue
      const frontloadsFromFinalRenderPass = SERVER_FRONTLOAD_QUEUE.length + 0
      const frontloadsLeftToRun =
        frontloadsFromFinalRenderPass - frontloadsInThisRender

      SERVER_FRONTLOAD_QUEUE = []

      if (
        process.env.NODE_ENV !== 'production' &&
        withLogging &&
        frontloadsLeftToRun > 0
      ) {
        log(
          'frontloadServerRender WARNING',
          `maxNestedFrontloadComponents (${maxNestedFrontloadComponents}) option in frontloadServerRender has been reached, ` +
            `yet there are still ${frontloadsLeftToRun} frontload child components to render. ` +
            `I.e. you have more levels of nesting in your app than your configuration allows. ` +
            `Server rendering will halt here and return the partially loaded result, which you probably don't want. ` +
            `To fix this, either increase the levels of nesting allowed, or restructure your app so that it has fewer levels ` +
            `of nested frontload components.`,
        )
        log(
          'frontloadServerRender info',
          `NOTE: as the logs show, the queue(s) are filled by the extra render pass that was one over maxNestedFrontloadComponents (${maxNestedFrontloadComponents}), ` +
            `however they are NOT flushed, so the frontload functions DO NOT actually run.`,
        )
      }

      return incompleteRenderOutput
    }

    // do a recursive call to do another render pass if the configured max is not yet exceeded
    return frontloadServerRenderWorker(
      render,
      { withLogging, maxNestedFrontloadComponents, continueRenderingOnError },
      renderNumber + 1,
      frontloadsInThisRender,
    )
  })
}

export function frontloadServerRender(render, options = {}) {
  if (!options.maxNestedFrontloadComponents) {
    // 1 (i.e. nesting OFF) is the default to not change behaviour from earlier 1.x versions
    options.maxNestedFrontloadComponents = 1
  }

  // delegate work to a private worker function so as to not expose the third and fourth arguments to the public API
  return frontloadServerRenderWorker(render, options)
}
