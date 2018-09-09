# react-frontload

[![npm version](https://img.shields.io/npm/v/react-frontload.svg?style=flat)](https://www.npmjs.com/package/react-frontload) [![Build Status](https://travis-ci.org/davnicwil/react-frontload.svg?branch=master)](https://travis-ci.org/davnicwil/react-frontload) ![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)


https://travis-ci.org/davnicwil/react-frontload.svg?branch=master

#### Bind a function to your component to load the data it needs.

#### Works on both server and client render.
---

#### Example

```jsx
import { frontloadConnect } from 'react-frontload'

const YourComponent = (props) => (
  <div>{props.data ? 'Loaded: ${props.data} : 'Loading...'}</div>
)

const loadData = () => new Promise(resolve => {
  setTimeout(() => resolve('This can be any data from anywhere'), 2000)
})

const frontload = async (props) => {
  const data = await loadData()
  yourStateManager.updateState(data) // e.g. redux dispatch
}

const YourConnectedComponent =
  yourStateManager.connectDataPropFromState( // e.g. redux connect
  frontloadConnect(frontload)(
    YourComponent
  ))
```

##### Client render

*The component renders immediately while data loads asynchronously*

```html
<div>Loading...</div>
```

*Then 2 seconds later, when the data loads*

```html
<div>Loaded: This can be any data from anywhere</div>
```

##### Server render

*Data loads synchronously. After a 2 second wait this markup is rendered and returned*

```html
<div>Loaded: This can be any data from anywhere</div>
```

---

#### What problem does this solve?


In most React applications, you need to load data from an API and dynamically render views based on that data.

This is simple to implement on the client with the built-in React lifecycle methods. However when you need to server render the components with the same data loaded, things become difficult because React does not (yet) support synchronous render. You cannot wait on anything async running in lifecycle methods before first render, so your data loading logic will not work.

There are a few patterns for solving this, but they all ultimately involve hoisting your data loading logic away from your component and binding it back to your component in some way to run via separate mechanisms on client and server. Writing this logic manually is tedious and error prone, and even when done correctly, introduces a level of diversion that makes code harder to understand.

`react-frontload` solves the problem, allowing you to write one function **on the component itself** that loads any data the component needs, which runs asynchronously on the client (so that you can display a loader whilst data is loading in the background) and synchronously on the server (so that your asynchronously loaded data is always included in the server render).

The design phllosophy of the library is that it is both 'Just React' and 'Just Javascript'. To integrate `react-frontload` you only need to wrap your application with a provider, and you are good to go. It plugs into your existing application via `props` and Promises. As such, it requires no special conventions or interfaces either in your React components or in your API. You are free to design your app however you choose, and use any stack you choose within the React ecosystem. `react-frontload` will work with anything.

#### It's still unclear / I'm not convinced

* [This blog post](https://medium.com/@davnicwil/react-frontload-3ff68988cca) gives a much more in-depth description of the library and motivation behind it, including sample code.

* [This blog post](https://medium.com/@cereallarceny/server-side-rendering-in-create-react-app-with-all-the-goodies-without-ejecting-4c889d7db25e) by Patrick Cason discusses a real-world example of using `react-frontload` to server-render a React application built with [create-react-app](https://github.com/facebook/create-react-app).


---

### API Reference

. . .

**frontloadConnect** Higher Order Component

```
frontloadConnect(
  frontload: (props: Object) => Promise<void>, // frontload function
  options?: { noServerRender: boolean, onMount: boolean, onUpdate: boolean} // frontload options
)(Component: React$Component)
```

This is the HOC which connects react-frontload and the Component you want to load data into.

*Arguments*

* `frontload: (props: Object) => Promise<void>` The function which loads your component's data. Takes any props you pass to the component, and returns a Promise which **must** resolve when all required data-loading is complete.


* `options?: { noServerRender: boolean, onMount: boolean, onUpdate: boolean}` The options configure when the frontload function should fire on both client and server.

  * `noServerRender (boolean) [default false]` Toggles whether or not the Component’s frontload function will run on server render.

  * `onMount (boolean) [default true]` Toggles whether or not the frontload function should fire when the Component mounts on the client.

  * `onUpdate (boolean) [default true]` Toggles whether or not the frontload function should fire when the Component’s props update on the client.

. . .

**Frontload** Provider Component

```
<Frontload noServerRender={[boolean] (optional, default false)}>
```

The react-frontload provider Component - it must be an ancestor of **all** Components in the tree that use `frontloadConnect`.

The `noServerRender` prop is a convenience which configures off server rendering for the entire application, if this is what you want, so that the `noServerRender` option does not have to be passed to every `frontloadConnect` HOC.

. . .

**frontloadServerRender** function

`frontloadServerRender: (renderMarkup: (dryRun: boolean (optional)) => string)`

The `react-frontload` server render wrapper which **must** be used on the server toenable the synchronous data loading on server render that `react-frontload` provides. This is of course not needed if you are not using server rendering in your application.

*Arguments*

  * `renderMarkup: (dryRun: boolean (optional)) => string` A function which performs the ordinary React server rendering logic, returning the server rendered markup. In the majority of cases, this will just be a wrapper for a `ReactDom.renderToString` call.
    * `dryrun: boolean` **You do not and should not need to use this or know about it in the majority of cases**. This is a special parameter for lower-level integration with `react-frontload` server render. Under the hood, `frontloadServerRender` is actually running the `renderMarkup` function twice, as a mechanism to run all the Promises in all the `frontload` functions throughout the application and then actually render the markup again once all those promises have resolved. This double-render may create issues in applications using libraries relying on global scope, so this boolean is passed to give the `renderMarkup` function knowledge of whether this is the first dry run, or the second actual render run. Again, if this is unclear, do not worry about it. In the majority of apps, you should not need to know about or integrate with the workings of `react-frontload` on this level.

You can think of this function as injecting the logic required to make `react-frontload` synchronous data loading work, into your existing application. This is in line with the design goals of the library, i.e. there are no requrements about how your server render function works, and indeed it can work in a completely standard way. As long as it is wrapped with `frontloadServerRender`, it will just work.

Importantly, this function may go away in future if more powerful mechanisms are introduced for synchronous server render in `React` itself. The way it works under the hood is just a workaround for the lack of this feature in `React` as of now. If you are interested in this, [this thread](https://github.com/facebook/react/issues/1739) contains a lot of info about this topic and is updated with the latest goings-on in this direction.

---