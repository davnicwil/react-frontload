import React from 'react'
import styled, { keyframes } from 'styled-components'

const ripple = keyframes`
  0% {
    top: 28px;
    left: 28px;
    width: 0;
    height: 0;
    opacity: 1;
  }
  100% {
    top: -1px;
    left: -1px;
    width: 58px;
    height: 58px;
    opacity: 0;
  }
`

const RippleContainer = styled.div`
  display: block;
  position: relative;
  width: 64px;
  height: 64px;
  margin: 32px auto;

  & div {
    position: absolute;
    border: 4px solid #fff;
    opacity: 1;
    border-radius: 50%;
    background: #526531;
    animation: ${ripple} 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
  }

  & div:nth-child(2) {
    animation-delay: -0.5s;
  }
`

const Ripple = () => (
  <RippleContainer>
    <div />
    <div />
  </RippleContainer>
)

const Container = styled.div`
  text-align: center;
`

const Text = styled.div`
  text-align: center;
  font-family: arial;
`

const Loader = (props) => (
  <Container {...props}>
    {props.text &&
      <Text>{props.text}</Text>
    }

    <Ripple />
  </Container>
)

export default Loader
