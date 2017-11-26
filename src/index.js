import React from 'react';
import PropTypes from 'prop-types';

let FRONTLOAD_QUEUES = []

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

const cleanQueues = (index) => {
  if (index === undefined) {
    FRONTLOAD_QUEUES = []
  } else {
    FRONTLOAD_QUEUES[index] = []
  }
}

const map = (arr, fn) => {
  const mapped = []
  for (let i = 0; i < arr.length; i++) mapped.push(fn(arr[i], i))

  return mapped
}

// util with same behaviour of Promise.all, except it does not short-cirucit
// to catch if one of the promises rejects. It resolves when all the passed promises
// have either resolved or rejected
const waitForAllToComplete = (promises) => (
  Promise.all(map(promises, (promise) => (
    promise['catch']((error) => error)
  )))
)

function flushQueues (index, options = {}) {
  if (index === undefined) return Promise.all(map(FRONTLOAD_QUEUES, (_, i) => flushQueues(i)))

  const frontloadPromises = []
  const queue = FRONTLOAD_QUEUES[index]

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

  cleanQueues(index)

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
        pushFrontload: (frontload, options, lifecylePhase, childProps, log) => {
          const isMount = lifecylePhase === LIFECYCLE_PHASES.MOUNT
          const isUpdate = lifecylePhase === LIFECYCLE_PHASES.UPDATE

          const queue = FRONTLOAD_QUEUES[this.queueIndex]

          // > if on server, and noServerRender is configured globally or locally for this frontload, don't push to the queue
          // > if the frontload is configured not to run for this lifecycle phase, don't push to the queue
          if (
            (this.isServer && (this.props.noServerRender || options.noServerRender)) ||
            (isMount && options.onMount === false) ||
            (isUpdate && options.onUpdate === false) ||
            (isUpdate && !queue.isInUpdateCycle)
          ) {
            return
          }

          log && log()

          queue.unshift({
            fn: () => frontload(childProps, { isMount, isUpdate }),
            options,
            componentDisplayName: childProps.displayName
          })
        },
        log: (message) => {
          this.props.withLogging && log(this.props.name, message)
        }
      }
    }
  }

  constructor (props, context) {
    super(props, context)

    this.isServer = (props.isServer === undefined)
      ? autoDetectIsServer()
      : props.isServer

    this.queueIndex = FRONTLOAD_QUEUES.push([]) - 1

    if (!this.isServer) {
      this.componentWillUpdate = () => {
        FRONTLOAD_QUEUES[this.queueIndex].isInUpdateCycle = true

        if (process.env.NODE_ENV !== 'production' && props.withLogging) {
          log(props.name, 'rendering subtree components. Filling frontload fn queue')
        }
      }

      // hook for first ever render on client (all subsequent renders are handled by componentDidUpdate)
      // by default, no frontloads are run on first render, because it is assumed that server rendering is being used
      // to run all frontloads and fetch data on the server, such that fresh data is available for this first client
      // render. However, this setup may not be appropriate for every app. We may want to rerun the frontload
      // functions on the first render on the client for certain, or all, components, for example if server
      // rendering is not set up at all, or if data may be stale at the time of first client render due to
      // server-side caching. There are 2 options to configure rerunning the frontload fn(s)
      // on first render - in a per-frontload option { noServerRender: true }, or in a prop on this
      // Frontload provider: { noServerRender: true }, which of course enables this for all frontload fns
      this.componentDidMount = () => {
        if (process.env.NODE_ENV !== 'production' && props.withLogging) {
          log(props.name, '[1st client render] all subtree components have rendered. Flushing frontload fn queue')
        }

        flushQueues(this.queueIndex, {
          noServerRender: props.noServerRender,
          firstClientRender: true,
          log: props.withLogging && ((message) => log(props.name, message))
        })

        if (process.env.NODE_ENV !== 'production' && props.withLogging) {
          log(props.name, '[1st client render] flushed frontload fn queue')
        }
      }

      this.componentDidUpdate = () => {
        FRONTLOAD_QUEUES[this.queueIndex].isInUpdateCycle = false
        if (process.env.NODE_ENV !== 'production' && props.withLogging) {
          log(props.name, 'all subtree components have rendered. Flushing frontload fn queue')
        }

        flushQueues(this.queueIndex)

        if (process.env.NODE_ENV !== 'production' && props.withLogging) {
          log(props.name, 'flushed frontload fn queue')
        }
      }
    }
  }

  render () {
    return React.Children.only(this.props.children)
  }
}

class FrontloadConnectedComponent extends React.Component {
  static contextTypes = {
    frontload: PropTypes.object
  }

  constructor (props, context) {
    super(props, context)

    if (context.frontload.isServer) {
      this.componentWillMount = this.pushFrontload(LIFECYCLE_PHASES.MOUNT)
    } else {
      this.componentDidMount = this.pushFrontload(LIFECYCLE_PHASES.MOUNT)
      this.componentDidUpdate = this.pushFrontload(LIFECYCLE_PHASES.UPDATE)
    }
  }

  pushFrontload = (lifecyclePhase) => () => {
    const log = (process.env.NODE_ENV !== 'production') && (() => {
      this.context.frontload.log(`add frontload fn to queue for component: [${this.props.component.displayName || 'anonymous'}]`)
    })

    this.context.frontload.pushFrontload(this.props.frontload, this.props.options, lifecyclePhase, this.props.componentProps, log)
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
  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log('frontloadServerRender info', 'running first render to fill frontload fn queue(s)')
  }

  // a first render is required to fill the frontload queue(s) wth the frontload
  // functions on the components in the subtrees under frontload containers that will be rendered
  // The result of this first render is useless, and is thrown away, so there is more work than
  // necessary done here. This could be improved, for example if a future version of react implements something like a
  // rendering dry-run to walk the component tree without actually doing the render at the end
  render()

  if (process.env.NODE_ENV !== 'production' && withLogging) {
    log('frontloadServerRender info', 'first render succeeded, frontend fn queue(s) filled')
    log('frontloadServerRender info', 'flushing frontend fn queue(s) before running second render...')
  }

  const startFlushAt = withLogging && Date.now()

  const rendered = flushQueues().then(() => {
    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log('frontloadServerRender info', `flushed frontload fn queue(s) in ${Date.now() - startFlushAt}ms`)
      log('frontloadServerRender info', 'Running second render.')
    }

    const output = render()

    // all queues get filled again on the second render. Just clean them, don't flush them
    cleanQueues()

    if (process.env.NODE_ENV !== 'production' && withLogging) {
      log('frontloadServerRender info', 'NOTE: as the logs show, the queue(s) are filled by Frontload before the second render, however they are NOT flushed, so the frontload fns DO NOT run twice.')
      log('frontloadServerRender info', 'second render succeeded. Server rendering is done.')
    }

    return output
  })

  return rendered
}
