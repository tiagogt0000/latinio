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

test('French URLs and preferences reopen French without touching stored learning data',()=>{
 const values=new Map([[LAST_SUBJECT_KEY,'french'],['latinio-french-progress','preserve this history']]);
 const local={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(currentSubject('',local),'french');assert.equal(values.get(LAST_SUBJECT_KEY),'french');
 rememberSubject('english',local);assert.equal(currentSubject('?subject=french',local),'french');
 rememberSubject('french',local);assert.equal(currentSubject('',local),'french');
 assert.equal(values.get('latinio-french-progress'),'preserve this history');assert.equal(values.size,2);
});

test('Unavailable preference storage never prevents local subject selection',()=>{
 const local={getItem(){throw Error('Storage unavailable');},setItem(){throw Error('Storage unavailable');}};
 assert.equal(currentSubject('',local),'latin');assert.equal(currentSubject('?subject=english',local),'english');
 assert.doesNotThrow(()=>rememberSubject('latin',local));
});
