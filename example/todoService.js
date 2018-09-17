// the mock time this 'service' takes to respond
const MOCK_LATENCY_MS = 2000

const TODOS = [{
  id: '001',
  text: 'Buy milk'
}, {
  id: '002',
  text: 'Send letter'
}, {
  id: '003',
  text: 'Print tickets'
}, {
  id: '004',
  text: 'Tidy desk'
}]

const getTodoById = (id) => {
  for (let i = 0; i < TODOS.length; i++) {
    if (TODOS[i].id === id) return TODOS[i]
  }
}

export const getAll = () =>
  new Promise((resolve) => {
    console.log(`[example app] todoService.getAll() - called`)
    const start = Date.now()

    setTimeout(() => {
      const end = Date.now()
      console.log(`[example app] todoService.getAll() - responded after ${end - start}ms`)

      resolve(TODOS)
    }, MOCK_LATENCY_MS)
  })

export const get = (id) =>
  new Promise((resolve, reject) => {
    console.log(`[example app] todoService.get(${id}) - called`)
    const start = Date.now()

    setTimeout(() => {
      const todo = getTodoById(id)

      if (todo) {
        const end = Date.now()
        console.log(`[example app] todoService.get(${id}) - responded after ${end - start}ms`)

        resolve(todo)
      } else {
        reject(new Error(`Could not find TODO with id [${id}]`))
      }
    }, MOCK_LATENCY_MS)
  })
