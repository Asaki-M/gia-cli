import { Octokit } from "octokit"

export function createOctokit(token) {
  if (!token) {
    return new Octokit()
  }

  return new Octokit({
    auth: token,
  })
}
