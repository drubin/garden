import logging
from flask import Flask, render_template, request, make_response, g
from redis import Redis
import os
import socket
import random
import json
import opentracing
from flask_opentracing import FlaskTracer


from jaeger_client import Config

log_level = logging.DEBUG
logging.getLogger('').handlers = []
logging.basicConfig(format='%(asctime)s %(message)s', level=log_level)

config = Config(
    config={ # usually read from some yaml config
        'local_agent': {
          'reporting_host': 'jaeger'
        },
        'sampler': {
            'type': 'const',
            'param': 1,
        },
        'logging': True,
    },
    service_name='vote',
    validate=True,
)



option_a = os.getenv('OPTION_A', "Cats")
option_b = os.getenv('OPTION_B', "Dogs")
hostname = socket.gethostname()

app = Flask(__name__)
# this call also sets opentracing.tracer
tracer = config.initialize_tracer()
tracer = FlaskTracer(tracer, True, app)

def get_redis():
    if not hasattr(g, 'redis'):
        g.redis = Redis(host="redis", db=0, socket_timeout=5)
    return g.redis

@app.route("/vote/", methods=['POST','GET'])
@tracer.trace()
def vote():
    voter_id = request.cookies.get('voter_id')
    print("hello")
    if not voter_id:
        voter_id = hex(random.getrandbits(64))[2:-1]

    vote = None

    if request.method == 'POST':
        redis = get_redis()
        vote = request.form['vote']
        data = json.dumps({'voter_id': voter_id, 'vote': vote})

        redis.rpush('votes', data)
        print("Registered vote")

    resp = make_response(render_template(
        'index.html',
        option_a=option_a,
        option_b=option_b,
        hostname=hostname,
        vote=vote,
    ))
    resp.set_cookie('voter_id', voter_id)
    return resp


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=80, debug=True, threaded=True)
