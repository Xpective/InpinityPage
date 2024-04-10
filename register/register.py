from flask import Flask, render_template, request, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'your_database_uri_here'
app.secret_key = 'your_secret_key_here'  # für die Session
db = SQLAlchemy(app)
oauth = OAuth(app)

google = oauth.register(
    name='google',
    client_id='your_google_client_id_here',
    client_secret='your_google_client_secret_here',
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={'scope': 'email'},
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(50), unique=True)
    password = db.Column(db.String(50))  # sollte in der Produktion gehasht sein
    role = db.Column(db.String(50))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']  # sollte in der Produktion gehasht sein
        role = request.form['role']

        # Google OAuth
        redirect_uri = url_for('authorize', _external=True)
        return google.authorize_redirect(redirect_uri)
        
    return render_template('register.html')

@app.route('/auth/google/callback')
def authorize():
    token = google.authorize_access_token()
    resp = google.get('userinfo')
    user_info = resp.json()
    user = User.query.filter_by(email=user_info['email']).first()
    
    if not user:
        # Rolle zuweisen und Registrierung abschließen
        new_user = User(email=user_info['email'], password=None, role=session.get('role', 'user'))
        db.session.add(new_user)
        db.session.commit()

    return redirect(url_for('dashboard'))

if __name__ == '__main__':
    app.run(debug=True)
