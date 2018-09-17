import React from 'react'
import { withRouter } from 'react-router-dom'

const cleanState = () => ({ todos: null, todo: null })

class Client extends React.Component {
  constructor (props) {
    super(props)

    this.state = props.initialState || cleanState()
  }

  get = () => this.state

  set = (key, value) => {
    this.setState({ [key]: value })
  }

  componentDidUpdate (prevProps) {
    const oldPath = prevProps.location.pathname
    const newPath = this.props.location.pathname

    if (oldPath !== newPath) {
      console.log(`[example app] route changed ${oldPath} > ${newPath} - state cleared`)

      this.setState(cleanState())
    }
  }

  render () {
    return this.props.children({ get: this.get, set: this.set })
  }
}

const StateManagerClient = withRouter(Client)

const StateManagerServer = () => {
  const state = cleanState()

  return {
    get: () => state,
    set: (key, value) => {
      state[key] = value
    }
  }
}

export default {
  Client: StateManagerClient,
  Server: StateManagerServer
}
