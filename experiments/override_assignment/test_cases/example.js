
function foo() {
    // console.log("foo");
  }
  var a = { fieldA1: 2 }
  var b
  b = 0 // left
  chamada(); // atribuição pra B aqui dentro // right
  b = 1 // right
  
  function chamada () {
    // b = 1 // right
  }
  
  function bar() {
    // console.log("bar");
  }
  
  for (var i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      foo();
    } else {
      bar();
    }
  }
  
  a.fieldA1 = 4 // right
  a.fieldA2 =  {a: 23}
  
  a = 24 // left