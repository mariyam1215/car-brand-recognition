#!/bin/sh
# Start the car brand website on your computer.  Mac/Linux:  sh run_demo.sh
cd "$(dirname "$0")/web" || exit 1

PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then
  echo "Python is not installed. Install it from https://www.python.org/downloads/ and run this again."
  exit 1
fi

URL=http://localhost:8000
echo
echo "Starting the website at $URL  (press Ctrl+C to stop)"
echo
( sleep 2; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") ) >/dev/null 2>&1 &
exec "$PY" -m http.server 8000
