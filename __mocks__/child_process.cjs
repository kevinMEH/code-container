const calls = [];
const queue = [];

function spawnSync(command, args, options) {
  calls.push({ command, args, options });
  if (queue.length > 0) {
    return queue.shift();
  }
  return { status: 0, stdout: "", stderr: "" };
}

spawnSync.__enqueue = function (result) {
  queue.push(result);
};

spawnSync.__getCalls = function () {
  return calls;
};

spawnSync.__reset = function () {
  calls.length = 0;
  queue.length = 0;
};

spawnSync.__getQueueLength = function () {
  return queue.length;
};

module.exports = { spawnSync };
