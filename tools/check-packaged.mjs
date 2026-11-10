import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
const exec=promisify(execFile),root=path.resolve('dist/本机工作室-win32-x64'),executable=path.join(root,'AgentOfficeStudio.exe');
const result=await exec(executable,['-e',"const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(':memory:');d.exec('create table proof(id integer)');console.log(JSON.stringify({node:process.versions.node,electron:process.versions.electron,sqlite:true}));d.close();"],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,timeout:15000});
const proof=JSON.parse(result.stdout.trim());await fs.writeFile('work/packaged-runtime-proof.json',JSON.stringify(proof,null,2));process.stdout.write(JSON.stringify(proof)+'\n');
