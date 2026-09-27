const { spawn } = require('child_process')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const processes = [
  [
    'Backend',
    path.join(projectRoot, 'backend', 'server.js'),
    [],
    path.join(projectRoot, 'backend'),
  ],
  [
    'Frontend',
    path.join(projectRoot, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
    ['--host', '0.0.0.0'],
    path.join(projectRoot, 'frontend'),
  ],
].map(([name, file, args, cwd]) => {
  const child = spawn(process.execPath, [file, ...args], {
    cwd,
    stdio: 'inherit',
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.log(`\n${name} stopped with code ${code}.`)
    }
  })

  return child
})

function stopAll() {
  processes.forEach((child) => child.kill())
}

process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
