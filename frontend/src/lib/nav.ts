// Lets non-component modules (sheet flows) navigate. App registers the router's navigate.
let _nav: (to: string) => void = () => {}
export const setNav = (fn: (to: string) => void) => { _nav = fn }
export const nav = (to: string) => _nav(to)
