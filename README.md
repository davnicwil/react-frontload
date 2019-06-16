# :arrows_counterclockwise: React Frontload
### Async data loading for React components, on client & server.

[![npm version](https://img.shields.io/npm/v/react-frontload.svg?style=flat)](https://www.npmjs.com/package/react-frontload) [![Build Status](https://travis-ci.org/davnicwil/react-frontload.svg?branch=master)](https://travis-ci.org/davnicwil/react-frontload) ![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)



Client render                   | Server render
:------------------------------:|:-----------------------------:
![](/docs/no-server-render.gif) |![](/docs/server-render.gif)

:point_up: The [example application](/docs/react-frontload-example-application.md) using **react-frontload** to load data

---

* [Quick example](#quick-example)
* [What problem does this solve?](#what-problem-does-this-solve)
* [API reference](#api-reference)

## Quick example
```jsx
// --- frontload component ---
import {
  frontloadConnect,
  frontloadServerRender
} from 'react-frontload'
import { connectStateManager } from 'any-state-manager' // e.g. redux, mobx etc

// the presentation for the component, displaying the data
// when it's loaded and 'loading' until then
const MyFrontloadComponentPresentation = (props) => (
  <div>{props.data ? `Loaded: ${props.data}` : 'Loading...'}</div>
)

// the function which loads data into the component - returns an EMPTY Promise
// that resolves when all data is loaded - frontload does NOT pass through any
// props to the component, it's just responsible for data loading - you should
// use a state manager to handle connecting state to your component
const frontloadFunction = async (props) => {
  const data = await api.loadData()
  props.stateManager.updateState(data) // e.g. redux dispatch
}

// wrap the component with frontloadConnect (and connect it to the stateManager - e.g redux)
// to make it a frontload component
const MyFrontloadComponent =
  connectStateManager( // e.g. redux connect
  frontloadConnect(frontloadFunction)( // use the data loading function above
    MyFrontloadComponentPresentation
  ))

// --- app ---
import { Frontload } from 'react-frontload'
import { StateManager } from 'any-state-manager'

const App = () => (
  <Frontload>
    <StateManager store={{}}>
      <MyFrontloadComponent />
      <SomeOtherComponent />
      <SomeOtherComponent />
      <SomeOtherComponent />
    </StateManager>
  </Frontload>
)

// --- client render --
import { render } from 'react-dom'

render(<App />, document.getElementById('root'))

// --- server render ---
import { renderToString } from 'react-dom/server'
import { frontloadServerRender } from 'react-frontload'

// notice that server render is asynchronous!
// The frontloadServerRender wrapper ensures that each frontload component in
// App has loaded its data before before the final markup is rendered
const serverRender = async () => {
  const reactRenderedMarkup = await frontloadServerRender(() => (
    renderToString(<App />)
  ))

  return putIntoHtmlDocument(reactRenderedMarkup)
}

// serve the server render from an endpoint, asynchronously
server.get('/', async (req, res) => {
  const markup = await serverRender()

  res.status(200).send(markup)
})

```

##### What happens on client render?
```html
MyFrontloadComponent renders, api.loadData() starts, the following is rendered:
->  <div>Loading...</div>

some time later api.loadData() finishes, component rerenders:
->  <div>Loaded: some data</div>
```

##### What happens on server render?
```html
Browser makes request for page containing MyFrontloadComponent, api.loadData() starts
->  Browser waits for response...

some time later api.loadData() finishes, final markup is then rendered, server responds
->  <...surrounding markup...>
      <div>Loaded: some data</div>
    <...surrounding markup...>
```

---

## What problem does this solve?

In most React applications, you need to load data from an API and dynamically render components based on that data.

This is easy to do on the client by loading data in lifecycle hooks like `componentDidMount` `componentDidUpdate` etc, and waiting until it's loaded to render. Client rendering lends itself well to async because the component is like a state machine that sits there indefinitely. You can spin off loading data, and just update the props whenever the loading is done.

On the server things are trickier because the component is more like a pure function. A run-once, props in, markup out, synchronous function. There's [no built-in way](https://github.com/facebook/react/issues/1739) to wait around for async data loading to happen once render begins.

Patterns exist for running data loading functions via *separate mechanisms* on client and server render, for instance doing things like hoisting data loading logic from all components under a route to the parent component of the route, then pulling that function off the route and running it every time the route matches, before running the render. This works but it's a lot of manual wiring, data loading logic often ends up quite far away from the components where the data is used, and there are lots of hidden problems like how do you ensure data loading isn't rerun wastefully on first client render after a server render?

Wouldn't it be great to have an abstraction that acts a bit like an async component hook, that runs any async data loading logic you need before the component renders on both client and server?

`react-frontload` provides that abstraction. You write your data loading function, bind it to the component via a Higher Order Component, wrap your application in the `Frontload` provider, wrap your server render function in `frontloadServerRender`, and it just works. On the server, your data loading runs before render. On the client, you can easily control if the data loading runs on mounts and updates, via a simple declaritive config passed to the HOC.

The design philosophy of `react-frontload` is 'Just React' and 'Just Javascript'. Unlike other data-loading patterns, it requires no special conventions or dependencies and just works out the box with any app using any stack from the React ecosystem. It requires no architectural changes to your app or your API. Just plug it in, and it works.

#### It's still unclear / I'm not convinced

* [This blog post](https://medium.com/@davnicwil/react-frontload-3ff68988cca) gives a more in-depth description of the library and motivation behind it, including sample code.

* [This blog post](https://medium.com/@cereallarceny/server-side-rendering-in-create-react-app-with-all-the-goodies-without-ejecting-4c889d7db25e) by Patrick Cason discusses a real-world example of using `react-frontload` to server-render a React application built with [create-react-app](https://github.com/facebook/create-react-app).

---

## API Reference

* [frontloadConnect](#frontloadConnect)
* [Frontload](#Frontload)
* [frontloadServerRender](#frontloadServerRender)

. . . . . . . . . .

#### frontloadConnect


```js
frontloadConnect(
  frontload: (props: Object) => Promise<void>, // frontload function
  options?: { // frontload options
    noServerRender: boolean [default false],
    onMount: boolean [default true],
    onUpdate: boolean [default false],

    // Experimental options - used to try out new ideas in the wild
    // should be considered unstable and subject to change or even removal
    _experimental_updateFunc: (prevProps: Object, newProps: Object) => boolean,
  }
)(Component: React$Component)
```

This is the Higher Order Component which connects react-frontload and the Component you want to load data into.

*Arguments*

* `frontload: (props: Object) => Promise<void>` The function which loads your Component's data. Takes any props you pass to the component, and returns a Promise which **must** resolve when all required data-loading is complete.


* `options:` The options configure when the frontload function should fire on both client and server.

  * `noServerRender: boolean [default false]` Toggles whether or not the Component’s frontload function will run on server render.

  * `onMount: boolean [default true]` Toggles whether or not the frontload function should fire when the Component mounts on the client.

  * `onUpdate: boolean [default false]` Toggles whether or not the frontload function should fire when the Component’s props update on the client.

  * `_experimental_updateFunc: (prevProps: Object, newProps: Object) => boolean` Experimental option. Should be considered unstable. For use in conjunction with `onUpdate` to control *when* the frontload should fire on updates. Similar in concept to the `shouldComponentUpdate` React lifecycle hook. For example, you might want to specify that the frontload should fire on an update only when certain props change. If the fronload should fire, return true, otherwise return false.

. . . . . . . . . .

#### Frontload

```jsx
<Frontload noServerRender={boolean}>
  <YourApplication />
</Frontload>
```

The react-frontload provider Component - it must be an ancestor of **all** components in the tree that use `frontloadConnect`.

*Props*
  * `noServerRender: boolean [default false]` a convenience to turn off server rendering for the entire application, if this is what you want, so that the `noServerRender` option does not have to be passed to every `frontloadConnect` HOC.

. . . . . . . . . .

#### frontloadServerRender

```js
frontloadServerRender: (
  renderMarkup: (dryRun?: boolean) => string,
  options?: {
    maxNestedFrontloadComponents: number [default 1],
    continueRenderingOnError: boolean [default false],
  }
)
```

The `react-frontload` server render wrapper which **must** be used on the server to enable the synchronous data loading on server render that `react-frontload` provides. This is of course not needed if you are not using server rendering in your application.

*Arguments*

  * `renderMarkup: (dryRun?: boolean) => string` A function which performs the ordinary React server rendering logic, returning the server rendered markup. In the majority of cases, this will just be a wrapper for a `ReactDom.renderToString` call.
    * `dryRun?: boolean` Used for low-level integration with `react-frontload` server render. Under the hood, `frontloadServerRender` is actually running the `renderMarkup` function twice. It runs the first time to run the `frontload` functions for all components included in the render, then a second time to render the final markup once all data has been loaded into state. As React renders are supposed to pure this usually does not create any issues, but in some applications server renders also include logic, typically from styling libraries etc, that must only be called once per render. This boolean is therefore passed to let your `renderMarkup` function know which type of server render is occuring, so that you can decide to only call such logic once on the second and final server render, for instance.
  * options:
    * `maxNestedFrontloadComponents: number [default 1]` The maximum levels of 'nested' frontload components that will render on the server. The term 'nested' here has a very specific meaning: it's a frontload component that is rendered as a child of another frontload component, conditionally, based on data loaded by the parent. Nested frontload components present a particular challenge with server rendering because each level must load in serial, and cannot load in parallel. On the client, this is less relevant because the successive levels render incrementally, but on the server we have to wait for *all* levels to render before returning anything. If there are many levels of nesting, this may result in long render times and poor UX. Where possible, nesting should be avoided and by default react-frontload only allows 1 level of nesting. This option allows you to increase that to accomodate nesting of frontload components in your app if this is unavoidable. Note that if your app contains more levels of nested frontload components than this limit allows, the server render will still work, but the rendered markup will simply show any levels beyond the max in their loading state, and these 'loading' components' frontload functions will *not* automatically fire on the client unless `noServerRender` is set `true` for those components (see `noServerRender` docs for more information), therefore the server render will produce something but will likely appear slightly broken to the user. This is by design, so that you can spot where your application breaks the configured limit, whilst not completely breaking server render. If this happens it may simply be a bug, or you may have to change your design to have fewer levels of nesting, or of course you may just up the limit.
    * `continueRenderingOnError: boolean [default false]` If any frontload function throws an Error, swallow it and just carry on rendering. The default is false, meaning the first encountered Error will be thrown by `frontloadServerRender`, so that it can be caught and handled (perhaps by responding with an error page).

You can think of this function as injecting the logic required to make `react-frontload` synchronous data loading work, into your existing application. This is in line with the design goals of the library, i.e. there are no requirements about how your server render function works, and indeed it can work in a completely standard way. As long as it is wrapped with `frontloadServerRender`, it will just work.

Importantly, this function may go away in future if more powerful mechanisms are introduced for synchronous server render in React itself. The way it works under the hood is just a workaround for the lack of this feature in React as of now.

If you are interested in this:

* [This Github Issue](https://github.com/facebook/react/issues/1739) on the React repo contains a lot of info about this topic and is updated with the latest goings-on in this direction.

* [This Hacker News thread](https://news.ycombinator.com/item?id=16696063) discusses how the upcoming React Suspense API could simplify the implementation of 'synchronous' server render, and even possibly replace the need for `react-frontload` in some cases.
