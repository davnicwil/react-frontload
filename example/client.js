import 'babel-regenerator-runtime' // for async/await
import React from 'react'
import { render } from 'react-dom'
import TodoApp from './TodoApp'

console.log('\n\n--- react-frontload example application ---\n\n')

const root = document.getElementById('app-root')

render(<TodoApp.Client initialState={window.initialState} />, root)
