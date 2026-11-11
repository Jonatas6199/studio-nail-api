import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanImportedName,importedAmount,importedDate,importedProcedure,importedTime,nameKey} from '../src/lib/history-import';
test('client names remove appointment labels but preserve distinguishing names',()=>{
 assert.equal(cleanImportedName('Unha Cliente Exemplo PAGA'),'Cliente Exemplo');
 assert.equal(cleanImportedName('Unha Priscila'),'Priscila');
 assert.equal(cleanImportedName('Remoção Lucimara'),'Lucimara');
 assert.equal(cleanImportedName('Unha casamento Renata (presente)'),'Renata');
 assert.equal(cleanImportedName('Unha Cliente Exemplo (- 10 reais)'),'Cliente Exemplo');
 assert.equal(cleanImportedName('Unha Cliente Exemplo (A) PAGA'),'Cliente Exemplo (A)');
 assert.equal(nameKey(' Jéssica '),nameKey('Jessica'));assert.notEqual(nameKey('Crys'),nameKey('Chrys'));
});
test('procedure classification follows the approved historical amount boundaries',()=>{
 assert.deepEqual(importedProcedure(0),{base:'cuticle',extra:0});
 assert.deepEqual(importedProcedure(11999),{base:'cuticle',extra:0});
 assert.deepEqual(importedProcedure(12000),{base:'alignment',extra:0});
 assert.deepEqual(importedProcedure(12002),{base:'alignment',extra:2});
 assert.deepEqual(importedProcedure(13000),{base:'alignment',extra:1000});
 assert.deepEqual(importedProcedure(14000),{base:'extension',extra:0});
 assert.deepEqual(importedProcedure(15000),{base:'extension',extra:1000});
 assert.deepEqual(importedProcedure(null),{base:'undefined',extra:0});
});
test('spreadsheet numbers, dates and mixed time formats preserve cents and missing values',()=>{
 assert.equal(importedDate(46206),'2026-07-03');
 assert.equal(importedAmount(121.19),12119);assert.equal(importedAmount(0),0);assert.equal(importedAmount(null),null);
 assert.equal(importedTime(0.666666666666667),'16:00');assert.equal(importedTime('09:00'),'09:00');assert.equal(importedTime(null),null);assert.equal(importedTime('9:00:00'),'09:00');
 assert.throws(()=>importedTime('25:00'));assert.throws(()=>importedAmount('120'));
});
