import fetch from 'isomorphic-fetch'

const IS_CLIENT = typeof window !== 'undefined'

const baseUrl = IS_CLIENT ? '' : 'http://localhost:8989'

export const getAll = async () => {
  const url = `${baseUrl}/api/todos/`
  const res = await fetch(url)

  return res.status === 200
    ? res.json()
    : Promise.reject(
        new Error(`Error fetching ${url}: status code ${res.status}`),
      )
}

export const get = async (todoId) => {
  const url = `${baseUrl}/api/todos/${todoId}`
  const res = await fetch(url)

  return res.status === 200
    ? res.json()
    : Promise.reject(
        new Error(`Error fetching ${url}: status code ${res.status}`),
      )
}
