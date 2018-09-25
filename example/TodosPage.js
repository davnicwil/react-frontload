import React from 'react'
import { frontloadConnect } from '../src'
import * as todoClient from './todoClient'
import Todo from './Todo'
import Loader from './Loader'

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

const Presentation = (props) => {
  const todos = props.stateManager.get().todos

  return (
    <div>
      {todos
        ? <TodosList todos={todos} />
        : <Loader text='Loading todos' />
      }
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

const ServerRender = frontloadConnect(
  frontload // no options needed, defaults are fine
)(Presentation)

const NoServerRender = frontloadConnect(
  frontload,
  {
    noServerRender: true // tell react-frontload that the data was not loaded on the server, so that it loads when the component mounts
  }
)(Presentation)

export default {
  ServerRender,
  NoServerRender
}
