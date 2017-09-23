const DEBUG = true;

export default function Console(parameters) {
  if (DEBUG) {
    console.log(...parameters);
  }
}
