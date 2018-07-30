# react-frontload

[See this blog post](https://medium.com/@davnicwil/react-frontload-3ff68988cca) for a detailed description of the library and API, including sample code.

In React applications, a common requirement is to render data which is dynamically loaded from an API into a component, on both server and client renders.

react-frontload is a library that lets you declaratively bind custom data loading logic to your components, and then automatically fires the data loading when the component renders on both server and client. 

It integrates easily into your existing React stack, and importantly, requires no changes to your data API.

### API

`frontloadConnect(frontload, [options])(Component)`

`frontloadConnect` is a HOC which connects react-frontload and the Component you want to load data into.

The frontload and options parameters:

`frontload(props)`

A function which is called with the Component props, and returns a Promise which must resolve when all the required data-loading is complete.

`[options]`

The optional options object provides three configurations that specify when exactly the frontload function should fire on both client and server. If any particular configuration is left undefined, it takes its default value. Likewise, if the entire options object is left undefined, all three configurations take their default values.

`noServerRender (boolean) [default false]`

Toggles whether or not the Component’s frontload function will run on server render.

`onMount (boolean) [default true]`

Toggles whether or not the frontload function should fire when the Component mounts on the client.

`onUpdate (boolean) [default true]`

Toggles whether or not the frontload function should fire when the Component’s props update on the client.

___

`Frontload`

The react-frontload provider Component - it must be an ancestor of all Components in the tree that use frontloadConnect.

It is configurable with a `noServerRender` prop which turns off server rendering for the entire application, as a convenience so that each individual Component does not need to set `noServerRender: true`.

___

`frontloadServerRender(renderFunction)`

The react-frontload server render wrapper which must be used on the server.

It takes a `renderFunction` argument which is itself a function that performs the ordinary React server rendering code and returns markup. In most cases this `renderFunction` will just be a wrapper for a `ReactDom.renderToString` call.

It returns the markup output by `renderFunction`, which can be sent as a response in the usual way.

The reason this wrapper function is required has to do with the way react-frontload works under the hood. You can think of `serverRender` as a proxy for your existing server rendering logic, that 'injects' the plumbing that makes react-frontload work.

Your `renderFunction` is executed firstly to build the react tree and execute all the frontload functions (your async requests for data). Once all the requests are completed we then call `renderFunction` a second time to generate final markup. This can cause an issue for anyone relying on global scope so we pass a boolean to signify the first dry-run.

```js
  frontloadServerRender((dryRun) => {
    // dryRun is either true or false.
  })
```



