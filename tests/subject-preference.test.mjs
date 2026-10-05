import test from 'node:test';
import assert from 'node:assert/strict';
import {currentSubject,rememberSubject,LAST_SUBJECT_KEY} from '../app/subject-preference.js';

function storage(initial){const data=new Map(initial?[[LAST_SUBJECT_KEY,initial]]:[]);return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};}

test('App remembers language locally and opens the last used language by default',()=>{
 const local=storage();assert.equal(currentSubject('',local),'latin');rememberSubject('english',local);assert.equal(local.getItem(LAST_SUBJECT_KEY),'english');assert.equal(currentSubject('',local),'english');
 rememberSubject('latin',local);assert.equal(currentSubject('',local),'latin');
});

test('An explicit language URL updates the local preference without a cloud dependency',()=>{
 const local=storage('english');assert.equal(currentSubject('?subject=latin',local),'latin');assert.equal(local.getItem(LAST_SUBJECT_KEY),'latin');assert.equal(currentSubject('?subject=english',local),'english');assert.equal(local.getItem(LAST_SUBJECT_KEY),'english');
});
