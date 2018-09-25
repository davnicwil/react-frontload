import React from 'react'
import { frontloadConnect } from '../src'
import * as todoClient from './todoClient'
import Todo from './Todo'
import Loader from './Loader'

const Presentation = (props) => {
  const todo = props.stateManager.get().todo

  return (
    <div>
      {todo
        ? <Todo todo={todo} />
        : <Loader text='Loading todo' />
      }
    </div>
  )
}

const frontload = (props) =>
  todoClient
    .get(props.todoId)
    .then((todo) => {
      props.stateManager.set('todo', todo)
    })

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
