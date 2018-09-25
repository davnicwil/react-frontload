# Example Application

Client render                   | Server render
:------------------------------:|:-----------------------------:
![](/docs/no-server-render.gif) |![](/docs/server-render.gif)


To run the example application, clone this repo and run `npm run example` in your terminal.

The code is [here](/example).

---

The example application is a complete, self-contained full stack Node & React application which demonstrates the use of **react-frontload**.

It has two pages: one showing a list of todos, the other showing a specific todo when you click on it.

The app renders in two modes, `/server-render` and `/no-server-render`, to make the difference between server rendering and non-server rendering clear side-by-side in the context of the same application.

Both the server and client have detailed logging so that you can get a good picture on what is going on when views render and data is loaded by **react-frontload** from your terminal/console.

Another curiosity of the example application is that, rather than use a popular state management library such as `redux` or `mobx`, it uses a dummy custom-built one. Why? To underscore the fact that **react-frontload** will work with absolutely anything and does not need or encourage the use of any particular stack.
