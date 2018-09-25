import React from 'react'
import {
  BrowserRouter,
  StaticRouter,
  Route,
  Redirect,
  Switch
} from 'react-router-dom'
import { Frontload } from '../src'
import TodosPage from './TodosPage'
import TodoPage from './TodoPage'
import StateManager from './StateManager'
import Layout from './Layout'

const Routes = ({ stateManager }) => (
  <Layout>
    <Switch>
      <Route
        path='/server-render/:id?'
        render={(props) => {
          const id = props.match.params.id

          return id
            ? <TodoPage.ServerRender stateManager={stateManager} todoId={id} />
            : <TodosPage.ServerRender stateManager={stateManager} />
        }}
      />

      <Route
        path='/no-server-render/:id?'
        render={(props) => {
          const id = props.match.params.id

          return id
            ? <TodoPage.NoServerRender stateManager={stateManager} todoId={id} />
            : <TodosPage.NoServerRender stateManager={stateManager} />
        }}
      />

      <Redirect to='/no-server-render' />
    </Switch>
  </Layout>
)

const App = ({ stateManager, initialState }) => (
  <Frontload log>
    {stateManager
      ? (
        <Routes stateManager={stateManager} />
      ) : (
        <StateManager.Client initialState={initialState}>
          {stateManager => <Routes stateManager={stateManager} />}
        </StateManager.Client>
      )}
  </Frontload>
)

const Client = (props) => (
  <BrowserRouter>
    <App initialState={props.initialState} />
  </BrowserRouter>
)

const Server = ({ location, context, stateManager }) => (
  <StaticRouter location={location} context={context}>
    <App stateManager={stateManager} />
  </StaticRouter>
)

export default {
  Client,
  Server
}
