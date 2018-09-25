import React from 'react'
import styled from 'styled-components'
import { withRouter, Link } from 'react-router-dom'

const COMMON = `
  font-family: arial;
  color: rgba(0,0,0,0.8);
  display: block;
  text-decoration: none;
  padding: 16px;
  border: 1px solid silver;
  border-radius: 3px;
  background: #A5D6A7;
  margin-bottom: 16px;
  text-align: center;
  box-shadow: rgba(0, 0, 0, 0.12) 0px 1px 6px, rgba(0, 0, 0, 0.12) 0px 1px 4px;
`

const TodoLink = styled(Link)`
  ${COMMON}

  transition: box-shadow 0.2s ease-out, background 0.1s ease-out;
  transform: translate3d(0,0,0);

  &:hover {
    background: #C8E6C9;
    box-shadow: rgba(0, 0, 0, 0.19) 0px 10px 30px, rgba(0, 0, 0, 0.23) 0px 6px 10px;
  }
`

const TodoNonLink = styled.div`
  ${COMMON}
`

const Presentation = (props) => {
  if (props.link) {
    return (
      <TodoLink to={`${props.location.pathname}/${props.todo.id}`}>
        {props.todo.text}
      </TodoLink>
    )
  }

  return <TodoNonLink>{props.todo.text}</TodoNonLink>
}

const Todo = withRouter(Presentation)

export default Todo
