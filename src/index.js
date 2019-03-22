import React from 'react'
import PropTypes from 'prop-types'

const LIFECYCLE_PHASES = {
  MOUNT: 0,
  UPDATE: 1
}

const log = (process.env.NODE_ENV !== 'production') && ((name, message) => {
  console.log(`[react-frontload]${name ? ` [${name}]` : ''} ${message}`)
})

const autoDetectIsServer = () => (
  typeof window === 'undefined' ||
  !window.document ||
  !window.document.createElement
)

const map = (arr, fn) => {
  const mapped = []
  for (let i = 0; i < arr.length; i++) mapped.push(fn(arr[i], i))

  return mapped
}

// util with same behaviour of Promise.all, except it does not short-circuit
// to catch if one of the promises rejects. It resolves when all the passed promises
// have either resolved or rejected
const waitForAllToComplete = (promises) => (
  Promise.all(map(promises, (promise) => (
    promise['catch']((error) => error)
  )))
)

function flushQueues (frontloadQueues, index, options = {}) {
  if (index === undefined) return Promise.all(map(frontloadQueues, (_, i) => flushQueues(frontloadQueues, i, options)))

  const frontloadPromises = []
  const queue = frontloadQueues[index]

  for (let i = 0; i < queue.length; i++) {
    const frontload = queue[i]
    if (!options.firstClientRender) {
      frontloadPromises.push(frontload.fn())
    } else if (options.noServerRender || frontload.options.noServerRender) {
      if (process.env.NODE_ENV !== 'production' && !!options.log) {
        options.log(`[1st client render] NOTE running frontload fn for component [${frontload.componentDisplayName}], since noServerRender === true ${options.noServerRender ? 'globally' : 'for this component'}`)
      }

      frontloadPromises.push(frontload.fn())
    }
  }

  frontloadQueues[index] = []

  return waitForAllToComplete(frontloadPromises)
}

export class Frontload extends React.Component {
  static childContextTypes = {
    frontload: PropTypes.object
  }

  getChildContext () {
    return {
      frontload: {
        isServer: this.isServer,
        firstClientRenderDone: this.isServer
          ? true
          : this.firstClientRenderDone,
        // this does the work of either executing the frontload function on the client,
        // or pushing it to the queue for eventual execution on the server
        pushFrontload: (frontload, options, lifecylePhase, childProps, logMessage) => {
          const isMount = lifecylePhase === LIFECYCLE_PHASES.MOUNT
          const isUpdate = lifecylePhase === LIFECYCLE_PHASES.UPDATE
          const noServerRender = this.props.noServerRender || options.noServerRender

          // get the queue, if on the server
          const queue = this.isServer
            ? this.props.context.frontloadQueues[this.queueIndex]
            : null

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

          // if on server -> add frontload to a queue for eventual execution
          if (this.isServer) {
            queue.unshift({
              fn: () => frontload(childProps, { isMount, isUpdate }),
              options,
              componentDisplayName: childProps.displayName
            })

            if (process.env.NODE_ENV !== 'production' && this.props.withLogging && logMessage) {
              log(this.props.name, `added frontload fn to queue ${logMessage}`)
            }
          // if on client -> just execute it immediately, but only after first client render is done if server rendering is enabled
          } else if (noServerRender || this.firstClientRenderDone) {
            frontload(childProps, { isMount, isUpdate })

            if (process.env.NODE_ENV !== 'production' && this.props.withLogging && logMessage) {
              log(this.props.name, `executed frontload fn ${logMessage}`)
            }
          // log when frontload is not run on client first render because of server rendering
          } else if (process.env.NODE_ENV !== 'production' && this.props.withLogging && logMessage) {
            log(this.props.name, `did not execute frontload fn on first client render ${logMessage}, since server rendering is enabled`)
          }
        }
      }
    }
  }

  constructor (props, context) {
    super(props, context)

    this.isServer = (props.isServer === undefined)
      ? autoDetectIsServer()
      : props.isServer

    if (this.isServer) {
      // ensure that the context is plugged in by failing immediately if it's not the case
      if (!isValidContext(props.context)) {
        throw new Error('For frontloadServerRender to work you must supply context as a prop to the <Frontload /> provider in the passed render function\n\ne.g.\n\nconst render = (dryRun, context) => (\n  renderToString(() => <Frontload context={context} />)\n)\n\n')
      }

      this.queueIndex = props.context.frontloadQueues.push([]) - 1
    }

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

      if (process.env.NODE_ENV !== 'production' && props.withLogging && !props.noServerRender) {
        log(props.name, '1st client render done, from now on all frontloads will run')
      }
    }
  }

  render () {
    return React.Children.only(this.props.children)
  }
}

function isValidContext (candidate) {
  return candidate &&
    candidate.frontloadQueues &&
    candidate.frontloadQueues.constructor === Array
}

class FrontloadConnectedComponent extends React.Component {
  static contextTypes = {
    frontload: PropTypes.object
  }

  constructor (props, context) {
    super(props, context)

    if (context.frontload.isServer) {
      this.componentWillMount = this.pushFrontload(LIFECYCLE_PHASES.MOUNT, true)
    } else {
      this.componentDidMount = this.pushFrontload(LIFECYCLE_PHASES.MOUNT)
      this.componentDidUpdate = this.pushFrontload(LIFECYCLE_PHASES.UPDATE)
    }
  }

  pushFrontload = (lifecyclePhase) => () => {
    const logMessage = (process.env.NODE_ENV !== 'production')
      ? null
      : `for component: [${this.props.component.displayName || 'anonymous'}] on [${(lifecyclePhase === LIFECYCLE_PHASES.MOUNT) ? 'mount' : 'update'}]`

    this.context.frontload.pushFrontload(this.props.frontload, this.props.options, lifecyclePhase, this.props.componentProps, logMessage)
  }

  render () {
    return <this.props.component {...this.props.componentProps} />
  }
}

export const frontloadConnect = (frontload, options = {}) => (component) => (props) => (
  <FrontloadConnectedComponent
    frontload={frontload}
    component={component}
    componentProps={props}
    options={options} />
)

export const frontloadServerRender = (render, withLogging) => {
  // used to trace parallel renders in logging, in case of bugs
  const renderId = (process.env.NODE_ENV !== 'production' && withLogging)
    ? Math.floor(Math.random() * 100000000)
    : null

  const frontloadQueues = []

  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log('frontloadServerRender info', `[${renderId}] running first render to fill frontload fn queue(s)`)
  }

  // a first render is required to fill the frontload queue(s) wth the frontload
  // functions on the components in the subtrees under frontload containers that will be rendered
  // The result of this first render is useless, and is thrown away, so there is more work than
  // necessary done here. This could be improved, for example if a future version of react implements something like a
  // rendering dry-run to walk the component tree without actually doing the render at the end
  // the true flag here signals that this render is just a "dry-run"
  render(true, { frontloadQueues })

  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log('frontloadServerRender info', `[${renderId}] first render succeeded, frontend fn queue(s) filled`)
    log('frontloadServerRender info', `[${renderId}] flushing frontend fn queue(s) before running second render...`)
  }

  const startFlushAt = withLogging && Date.now()

  const rendered = flushQueues(frontloadQueues).then(() => {
    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log('frontloadServerRender info', `[${renderId}] flushed frontload fn queue(s) in ${Date.now() - startFlushAt}ms`)
      log('frontloadServerRender info', `[${renderId}] Running second render.`)
    }

    const output = render(false, { frontloadQueues })

    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log('frontloadServerRender info', `[${renderId}] NOTE: as the logs show, the queue(s) are filled by Frontload before the second render, however they are NOT flushed, so the frontload fns DO NOT run twice.`)
      log('frontloadServerRender info', `[${renderId}] second render succeeded. Server rendering is done.`)
    }

    return output
  })

  return rendered
}
