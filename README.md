# react-frontload

[![npm version](https://img.shields.io/npm/v/react-frontload.svg?style=flat)](https://www.npmjs.com/package/react-frontload) [![Build Status](https://travis-ci.org/davnicwil/react-frontload.svg?branch=master)](https://travis-ci.org/davnicwil/react-frontload) ![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

#### Write a single function on your React component to the load data it needs, on both client and server render.

---

Here is the [example application](/docs/react-frontload-example-application.md) using **react-frontload** to load data


Client render                   | Server render
:------------------------------:|:-----------------------------:
![](/docs/no-server-render.gif) |![](/docs/server-render.gif)

---

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

The design phllosophy of the library is that it is both 'Just React' and 'Just Javascript'. It plugs into your existing application via `props` and `Promises`. It therefore requires no special conventions or interfaces either in your React components or in your API. You are free to build your app however you choose, using any stack within the React ecosystem. Even if you have an existing app, `react-frontload` can be integrated into it easily. Just drop it in, and it works.

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

* `frontload: (props: Object) => Promise<void>` The function which loads your component's data. Takes any props you pass to the component, and returns a Promise which **must** resolve when all required data-loading is complete.


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
frontloadServerRender: (renderMarkup: (dryRun?: boolean) => string)
```
Alternatively, for `renderToNodeStream` use 
```js
frontloadServerRenderToStream: (renderMarkup: (dryRun?: boolean) => NodeJS.ReadableStream)
```

The `react-frontload` server render wrapper which **must** be used on the server to enable the synchronous data loading on server render that `react-frontload` provides. This is of course not needed if you are not using server rendering in your application.

*Arguments*

  * `renderMarkup: (dryRun?: boolean) => string` A function which performs the ordinary React server rendering logic, returning the server rendered markup. In the majority of cases, this will just be a wrapper for a `ReactDom.renderToString` call.
    * `dryRun?: boolean` Used for low-level integration with `react-frontload` server render. Under the hood, `frontloadServerRender` is actually running the `renderMarkup` function twice. It runs the first time to run the `frontload` functions for all components included in the render, then a second time to render the final markup once all data has been loaded into state. As React renders are supposed to pure this usually does not create any issues, but in some applications server renders also include logic, typically from styling libraries etc, that must only be called once per render. This boolean is therefore passed to let your `renderMarkup` function know which type of server render is occuring, so that you can decide to only call such logic once on the second and final server render, for instance.

You can think of this function as injecting the logic required to make `react-frontload` synchronous data loading work, into your existing application. This is in line with the design goals of the library, i.e. there are no requirements about how your server render function works, and indeed it can work in a completely standard way. As long as it is wrapped with `frontloadServerRender`, it will just work.

Importantly, this function may go away in future if more powerful mechanisms are introduced for synchronous server render in React itself. The way it works under the hood is just a workaround for the lack of this feature in React as of now.

If you are interested in this:

* [This Github Issue](https://github.com/facebook/react/issues/1739) on the React repo contains a lot of info about this topic and is updated with the latest goings-on in this direction.

* [This Hacker News thread](https://news.ycombinator.com/item?id=16696063) discusses how the upcoming React Suspense API could simplify the implementation of 'synchronous' server render, and even possibly replace the need for `react-frontload` in some cases.
