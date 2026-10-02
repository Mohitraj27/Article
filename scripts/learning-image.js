import { createCanvas } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { projectRoot } from './uploads.js'

const canvas = createCanvas(1200, 660)
const context = canvas.getContext('2d')
context.fillStyle = '#ffffff'
context.fillRect(0, 0, 1200, 660)
context.fillStyle = '#ededed'
for (let row = 24; row < 660; row += 24) {
  for (let column = 24; column < 1200; column += 24) context.fillRect(column, row, 1, 1)
}

context.fillStyle = '#171717'
context.font = 'bold 46px Georgia'
context.fillText('Reinforcement learning', 76, 100)
context.font = '23px Arial'
context.fillStyle = '#666666'
context.fillText('Learning through interaction', 78, 144)

context.fillStyle = '#171717'
context.fillRect(110, 240, 320, 185)
context.strokeStyle = '#171717'
context.lineWidth = 2
context.fillStyle = '#ffffff'
context.fillRect(770, 240, 320, 185)
context.strokeRect(770, 240, 320, 185)

context.textAlign = 'center'
context.fillStyle = '#ffffff'
context.font = 'bold 32px Georgia'
context.fillText('Agent', 270, 295)
context.font = '21px Arial'
context.fillText('Chooses an action', 270, 344)
context.fillText('Updates its policy', 270, 378)
context.fillStyle = '#171717'
context.font = 'bold 32px Georgia'
context.fillText('Environment', 930, 295)
context.font = '21px Arial'
context.fillText('Changes state', 930, 344)
context.fillText('Returns feedback', 930, 378)

function arrowHead(horizontal, vertical, angle) {
  context.beginPath()
  context.moveTo(horizontal - 13 * Math.cos(angle - Math.PI / 6), vertical - 13 * Math.sin(angle - Math.PI / 6))
  context.lineTo(horizontal, vertical)
  context.lineTo(horizontal - 13 * Math.cos(angle + Math.PI / 6), vertical - 13 * Math.sin(angle + Math.PI / 6))
  context.stroke()
}

context.lineWidth = 3
context.beginPath()
context.moveTo(430, 332)
context.lineTo(760, 332)
context.stroke()
arrowHead(760, 332, 0)
context.font = '22px Arial'
context.fillText('Action', 600, 311)

context.beginPath()
context.moveTo(930, 426)
context.lineTo(930, 515)
context.lineTo(270, 515)
context.lineTo(270, 438)
context.stroke()
arrowHead(270, 438, -Math.PI / 2)
context.fillText('Observation + reward', 600, 492)
context.fillStyle = '#666666'
context.font = '20px Arial'
context.fillText('Repeated experience helps the agent learn better decisions.', 600, 604)

const destination = path.join(projectRoot, 'public', 'uploads', 'Reinforcement-learning.png')
await writeFile(destination, await canvas.encode('png'))
console.log('Generated public/uploads/Reinforcement-learning.png')