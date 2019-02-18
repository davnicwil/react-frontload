import React from 'react'
import styled from 'styled-components'
import { frontloadConnect } from '../src'
import * as todoClient from './todoClient'
import Todo from './Todo'
import Loader from './Loader'

const NestedTodoTitle = styled.div`
  font-family: arial;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
`

const NestedTodoLoaded = styled(NestedTodoTitle)`
  color: green;
`

const NestedTodoContainer = styled.div`
  padding-left: 16px;
  border-left: 1px solid silver;
  border-radius: 0;
`

const Presentation = (props) => {
  const todo = props.stateManager.get().todo[props.todoId]

  // this obviously requires knowledge of the static todo ids,
  // but this is just a demonstration of frontloading nested components,
  // so keeping it simple
  const nextTodoId = todo ? `00${parseInt(props.todoId) + 1}` : null

  return (
    <div>
      {todo // the nested todos are frontloaded in serial here *on purpose*, to test the nested frontloading feature
        ? (
          <div>
            <NestedTodoTitle>todo [{todo.id}]</NestedTodoTitle>
            <Todo todo={todo} />
            <NestedTodoContainer>
              {nextTodoId !== '005'
                ? props.type === 'server-render'
                  ? <ServerRender stateManager={props.stateManager} todoId={nextTodoId} />
                  : <NoServerRender stateManager={props.stateManager} todoId={nextTodoId} />
                : <NestedTodoLoaded>All todos loaded!</NestedTodoLoaded>
              }
            </NestedTodoContainer>
          </div>
        )
        : (
          <div>
            <NestedTodoTitle>Loading todo [{props.todoId}]</NestedTodoTitle>
            <Loader />
          </div>
        )
      }
    </div>
  )
}

const ServerRenderPresentation = (props) => (
  <Presentation {...props} type='server-render' />
)

const NoServerRenderPresentation = (props) => (
  <Presentation {...props} type='no-server-render' />
)

const frontload = (props) =>
  todoClient
    .get(props.todoId) // initial todoId is passed from the Route for the initial nested component
    .then((todo) => {
      const currentTodoValue = props.stateManager.get().todo
      props.stateManager.set('todo', { ...currentTodoValue, [props.todoId]: todo })
    })

const ServerRender = frontloadConnect(
  frontload // no options needed, defaults are fine
)(ServerRenderPresentation)

const NoServerRender = frontloadConnect(
  frontload,
  {
    noServerRender: true // tell react-frontload that the data was not loaded on the server, so that it loads when the component mounts
  }
)(NoServerRenderPresentation)

export default {
  ServerRender,
  NoServerRender
}
