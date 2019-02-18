import React from 'react'
import styled from 'styled-components'
import { frontloadConnect } from '../src'
import * as todoClient from './todoClient'
import Todo from './Todo'
import Loader from './Loader'
import { withRouter, Link } from 'react-router-dom'

const TodosList = ({ todos }) => (
  <div>
    {todos.map(todo => (
      <Todo
        key={todo.id}
        todo={todo}
        link
      />
    ))}
  </div>
)

const NestedComponentsTestPageLink = styled(Link)`
  margin: 32px 0;
  display: block;
  text-align: center;
  text-decoration: none;
  border: 1px solid silver;
  padding: 8px 16px;
  border-radius: 3px;
  font-family: Arial;
`

const Presentation = (props) => {
  const todos = props.stateManager.get().todos

  return (
    <div>
      {todos
        ? <TodosList todos={todos} />
        : <Loader text='Loading todos' />
      }
      <NestedComponentsTestPageLink to={`${props.location.pathname}/nested-components`}>
        Test nested frontload components render
      </NestedComponentsTestPageLink>
    </div>
  )
}

const frontload = (props) => (
  todoClient
    .getAll()
    .then((todos) => {
      props.stateManager.set('todos', todos)
    })
)

const ServerRender = withRouter(
  frontloadConnect(
    frontload // no options needed, defaults are fine
  )(
    Presentation
  ))

const NoServerRender = withRouter(
  frontloadConnect(
    frontload,
    {
      noServerRender: true // tell react-frontload that the data was not loaded on the server, so that it loads when the component mounts
    }
  )(
    Presentation
  ))

export default {
  ServerRender,
  NoServerRender
}
