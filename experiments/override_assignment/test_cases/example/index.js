function func1 () {
//   b = 1
}
  
function foo() {
  // console.log("foo");
}

function bar() {
  // console.log("bar");
}

var a
a = { fieldA1: 2 } // left


var b
b = 0 // left
foo()
func1(); // right, atribuição pra B aqui dentro
b = 1 // right

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