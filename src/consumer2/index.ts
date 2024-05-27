exports.handler = (message: any, context: any) => {
  context;

  console.log(JSON.stringify(message, undefined, 2))

  const name = message.data
    ? Buffer.from(message.data, 'base64').toString()
    : 'World';

  console.log(`Hello, ${name}!`);
};