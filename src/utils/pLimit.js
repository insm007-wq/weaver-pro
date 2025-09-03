// 간단한 동시 실행 제한자
export default function pLimit(concurrency = 3) {
  let active = 0;
  const queue = [];

  const next = () => {
    active--;
    if (queue.length) queue.shift()();
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      const run = () => {
        active++;
        Promise.resolve()
          .then(fn)
          .then(
            (v) => {
              resolve(v);
              next();
            },
            (e) => {
              reject(e);
              next();
            }
          );
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
}
