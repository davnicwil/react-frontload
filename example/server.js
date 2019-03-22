import 'babel-regenerator-runtime' // for async/await
import express from 'express'
import path from 'path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import serializeJavascript from 'serialize-javascript'
import TodoApp from './TodoApp'
import * as todoService from './todoService'
import { frontloadServerRender } from '../src'
import StateManager from './StateManager'
import { ServerStyleSheet } from 'styled-components'

// change this if you need to
const PORT = 8989

const app = express()

app.get('/client.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, '/client.bundle.js'))
})

const toSanitizedJSONString = (obj) =>
  serializeJavascript(obj, { isJSON: true })

const buildHtml = (serverRenderedMarkup, styleTags, initialState) => `
  <html>
  <head>
    <title>react-frontload example</title>
    ${initialState ? `<script>window.initialState=${toSanitizedJSONString(initialState)}</script>` : ''}
    ${styleTags || ''}
  </head>
  <body>
    <div id="app-root">${serverRenderedMarkup}</div>
    <script src="/client.bundle.js"></script>
  </body>
  </html>
`

app.get('/server-render*', async (req, res) => {
  const location = req.url
  const routerContext = {}
  const stateManager = StateManager.Server()
  const sheet = new ServerStyleSheet()

  // this is the ordinary synchronous server rendering logic every app should have, wrapped in a function
  const renderMarkup = (dryRun, frontloadContext) => {
    console.log(dryRun
      ? `[example app] ${location} - loading data...`
      : `[example app] ${location} - all data loaded, rendering markup...`
    )

    const app = <TodoApp.Server
      location={location}
      frontloadContext={frontloadContext}
      routerContext={routerContext}
      stateManager={stateManager}
    />

    const serverRenderedMarkup = dryRun
      ? renderToString(app)
      : renderToString(sheet.collectStyles(app))

    return serverRenderedMarkup
  }

  console.log(`[example app] ${location} - starting server render`)
  const start = Date.now()

  // to enable async server render via react-frontload, just wrap your server render function with frontloadServerRender
  const serverRenderedMarkup = await frontloadServerRender(renderMarkup)
  const end = Date.now()
  const redirect = routerContext.url

  if (redirect) {
    console.log(`[example app] ${location} - resolved with redirect to ${redirect}`)

    res.redirect(redirect)
  } else {
    console.log(`[example app] ${location} - completed server render in ${end - start}ms`)

    res.status(200).send(buildHtml(serverRenderedMarkup, sheet.getStyleTags(), stateManager.get()))
  }
})

app.get('/no-server-render*', (req, res) => {
  res.status(200).send(buildHtml())
})

app.get('/api/todos', async (req, res) => {
  res.type('json')
  console.log(`[example app] GET ${req.url}: request received`)

  try {
    const todos = await todoService.getAll()

    console.log(`[example app] GET ${req.url}: sending response`)
    res.status(200).send(todos)
  } catch (err) {
    console.log('[example app] ERROR loading todos', err)
    res.status(400).send()
  }
})

app.get('/api/todos/:todoId', async (req, res) => {
  res.type('json')
  console.log(`[example app] GET ${req.url}: request received`)

  const todoId = req.params.todoId

  try {
    const todo = await todoService.get(req.params.todoId)

    console.log(`[example app] GET ${req.url}: sending response`)
    res.status(200).send(todo)
  } catch (err) {
    console.log(`[example app] ERROR loading todo '${todoId}'`, err)
    res.status(404).send()
  }
})

app.get('*', (req, res) => {
  res.redirect('/server-render')
})

app.listen(PORT, (err) => {
  if (err) {
    console.log('\n\nCould not start server:\n\n', err)
  } else {
    console.log(`\n\n> Started server, go to http://localhost:${PORT}\n\n`)
  }
})
