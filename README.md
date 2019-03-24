# react-frontload

[![npm version](https://img.shields.io/npm/v/react-frontload.svg?style=flat)](https://www.npmjs.com/package/react-frontload) [![Build Status](https://travis-ci.org/davnicwil/react-frontload.svg?branch=master)](https://travis-ci.org/davnicwil/react-frontload) ![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

#### Load data asynchronously into your React components. Works on both client and server render.

> A critical bug which caused issues with multiple server renders happening in parallel was fixed in v1.0.5. **Upgrade immediately to v1.0.5**! It has the same API as previous versions, so will 'just work'.

Client render                   | Server render
:------------------------------:|:-----------------------------:
![](/docs/no-server-render.gif) |![](/docs/server-render.gif)

:point_up: The [example application](/docs/react-frontload-example-application.md) using **react-frontload** to load data

* [Quick code example](#quick-code-example)
* [What problem does this solve](#what-problem-does-this-solve)
* [API reference](#api-reference)

## Quick code example
```jsx
import { frontloadConnect } from 'react-frontload'

// async data loading inside frontload function
const frontload = async (props) => {
  const data = await yourAPI.loadData() // takes 2 seconds
  yourStateManager.updateState(data) // e.g. redux dispatch
}

// the raw component, which renders a data prop containing the async loaded data
const Presentation = (props) => (
  <div>{props.data ? `Loaded: ${props.data}` : 'Loading...'}</div>
)

const YourComponent =
  yourStateManager.connectDataPropFromState( // e.g. redux connect
  frontloadConnect(frontload)( // frontload function bound to component here
    Presentation
  ))
```

##### What happens on client render?
```html
component renders, loadData() starts
-> <div>Loading...</div>

2 seconds later, loadData() finishes, component rerenders
-> <div>Loaded: some data</div>
```

##### What happens on server render?
```html
Browser requests page containing YourComponent, loadData() runs on server
->  Browser waits for response...

loadData() runs in 2 seconds, server renders and responds with
->  <div>Loaded: some data</div>
```

##### Is any more code required to make this work?

Yes, but it is extremely simple. Only two changes are required:

* Wrap your application in the `<Frontload>` Provider.
* Wrap your server render logic with the `frontloadServerRender` function.



## What problem does this solve?


In most React applications, you need to load data from an API and dynamically render components based on that data.

This is simple to implement on the client with the built-in React lifecycle methods. However when you need to server render components with the same data pre-loaded, things become more difficult because React does not ([yet](https://github.com/facebook/react/issues/1739)) support asynchronous render. This means you can't wait on anything async running in lifecycle methods before the first render happens, so on the server you can't reuse your data loading logic written inside lifecycle methods.

Patterns do exist for writing data loading functions and binding them to components, for running via separate mechanisms on client and server render, but they involve manual wiring and often doing things like hoisting data loading logic from all components under a route to the parent component of the route, to make things more manageable. Furthermore, you must explictly handle not wastefully reloading data on the client immediately after a server render.

`react-frontload` solves the problem. All this wiring is done for you. You can just write one function, colocated with the component, that loads the data the component needs. `react-frontload` takes care of running the function asynchronously on the client and 'synchronously' on the server, i.e. waiting until all data is loaded for all components being rendered, before rendering the final markup and responding.

It also takes care of not reloading data immediately after a server render, and you can manually configure if the data reloads on client-side component mounts and updates for super fine-grained control, all with a simple declarative configuration on the component.

The design philosophy of the library is that it is both 'Just React' and 'Just Javascript'. It plugs into your existing application via `props` and `Promises`. It requires no special conventions or interfaces either in your React components or in your API. You are free to build your app however you choose, using any stack within the React ecosystem. `react-frontload` can be integrated into an existing app easily. Just drop it in, and it works.

#### It's still unclear / I'm not convinced

* [This blog post](https://medium.com/@davnicwil/react-frontload-3ff68988cca) gives a much more in-depth description of the library and motivation behind it, including sample code.

* [This blog post](https://medium.com/@cereallarceny/server-side-rendering-in-create-react-app-with-all-the-goodies-without-ejecting-4c889d7db25e) by Patrick Cason discusses a real-world example of using `react-frontload` to server-render a React application built with [create-react-app](https://github.com/facebook/create-react-app).

## API Reference

* [frontloadConnect](#frontloadConnect)
* [Frontload](#Frontload)
* [frontloadServerRender](#frontloadServerRender)

. . . . . . . . . .

#### frontloadConnect


```js
frontloadConnect(
  frontload: (props: Object) => Promise<void>, // frontload function
  options?: { noServerRender: boolean, onMount: boolean, onUpdate: boolean} // frontload options
)(Component: React$Component)
```

This is the HOC which connects react-frontload and the Component you want to load data into.

*Arguments*

* `frontload: (props: Object) => Promise<void>` The function which loads your Component's data. Takes any props you pass to the component, and returns a Promise which **must** resolve when all required data-loading is complete.


* `options?: { noServerRender: boolean, onMount: boolean, onUpdate: boolean}` The options configure when the frontload function should fire on both client and server.

  * `noServerRender: boolean [default false]` Toggles whether or not the Component’s frontload function will run on server render.

  * `onMount: boolean [default true]` Toggles whether or not the frontload function should fire when the Component mounts on the client.

  * `onUpdate: boolean [default true]` Toggles whether or not the frontload function should fire when the Component’s props update on the client.

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
frontloadServerRender: (renderMarkup: (dryRun: boolean) => string)
```

The `react-frontload` server render wrapper which **must** be used on the server to enable the synchronous data loading on server render that `react-frontload` provides. This is of course not needed if you are not using server rendering in your application.

*Arguments*

  * `renderMarkup: (dryRun: boolean) => string` This callback function acts as the glue between `react-frontload` and your existing server render logic, making async server rendering work. It should return exactly what normal server render code returns - in most cases the output of `ReactDom.renderToString`. This function injects an argument for lower-level integration with the render, for apps that need it:
    * `dryRun: boolean` This is a flag used to let you know when the 'final' server render is taking place. `react-frontload` actually runs the server render more than once, as part of its mechanic to make async server rendering work, and some libraries in the React excosystem are built with the assumption that server rendering only occurs once. For instance, `styled-components`, when it generates css on the server. For libraries such as these, you can use this flag to only run the server render parts when it is set `false`, i.e. on the final render.

You can think of this function as injecting the logic required to make `react-frontload` synchronous data loading work, into your existing application. This is in line with the design goals of the library, i.e. there are no requirements about how your server render function works, and indeed it can work in a completely standard way. As long as it is wrapped with `frontloadServerRender`,  it will just work.

Importantly, this function may go away in future if more powerful mechanisms are introduced for synchronous server render in React itself. The way it works under the hood is just a workaround for the lack of this feature in React as of now.

If you are interested in this:

* [This Github Issue](https://github.com/facebook/react/issues/1739) on the React repo contains a lot of info about this topic and is updated with the latest goings-on in this direction.

* [This Hacker News thread](https://news.ycombinator.com/item?id=16696063) discusses how the upcoming React Suspense API could simplify the implementation of 'synchronous' server render, and even possibly replace the need for `react-frontload` in some cases.
