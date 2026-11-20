#!/usr/bin/env node
/* Run every npm regression test even when one fails, so CI reports all
   regressions in one pass. Do not change the normal npm test command. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const commands = pkg.scripts.test.split(' && ');
const failed = [];
for(const [index, command] of commands.entries()){
  const args = command.trim().split(/\s+/);
  if(args.shift() !== 'node') throw new Error('Unexpected test command: '+command);
  console.log('\n===== Regression '+(index+1)+'/'+commands.length+': '+command+' =====');
  const result = spawnSync(process.execPath, args, {stdio:'inherit'});
  if(result.error || result.status !== 0){
    failed.push(command);
    console.error('FAILED: '+command+(result.error ? ' ('+result.error.message+')' : ''));
  }
}
console.log('\n===== Regression summary: '+(commands.length-failed.length)+'/'+commands.length+' commands passed =====');
if(failed.length){
  for(const command of failed) console.error('  FAILED: '+command);
  process.exitCode = 1;
}
