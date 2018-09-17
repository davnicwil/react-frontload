import React from 'react'
import styled from 'styled-components'
import { Link, withRouter } from 'react-router-dom'

const MenuContainer = styled.div`
  margin-bottom: 16px;
  text-align: center;

  & > .first {
    margin-right: 16px;
  }
`

const Button = styled.div`
  font-family: arial;
  color: rgba(0,0,0,0.8);
  text-decoration: none;
  padding: 8px 16px;
  border: 1px solid silver;
  border-radius: 3px;
  background:
    ${props => props.active ? 'rgb(235,235,235)' : 'rgb(255,255,255)'};
  transition: background 0.1s linear;
  display: inline-block;
  margin-bottom: 16px;

  &:hover {
    background: rgb(235,235,235);
  }
`

const Menu = (props) => (
  <MenuContainer>
    <a className='first' href='/server-render'>
      <Button active={props.location.pathname === '/server-render'}>
        server rendered todos
      </Button>
    </a>
    <Link to='/no-server-render'>
      <Button active={props.location.pathname === '/no-server-render'}>
        non server rendered todos
      </Button>
    </Link>
  </MenuContainer>
)

const Container = styled.div`
  padding: 16px 16px 0;
  border-radius: 3px;
  border: 1px solid silver;
  max-width: 500px;
`

const Presentation = (props) => (
  <Container>
    <Menu {...props} />
    {props.children}
  </Container>
)

const Layout = withRouter(Presentation)

export default Layout
