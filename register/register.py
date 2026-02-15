from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///inpinity.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
db = SQLAlchemy(app)
CORS(app)  # Enable CORS for all routes

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    wallet = db.Column(db.String(42), unique=True, nullable=False)  # Ethereum address
    username = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'wallet': self.wallet,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }

# Create tables
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return redirect(url_for('register_page'))

@app.route('/register')
def register_page():
    """Serve the registration HTML page"""
    return render_template('register.html')

@app.route('/api/register', methods=['POST'])
def register_wallet():
    """
    Register a new user with wallet address.
    Expected JSON: { "wallet": "0x...", "username": "optional", "email": "optional" }
    """
    data = request.get_json()
    if not data or 'wallet' not in data:
        return jsonify({'error': 'Wallet address required'}), 400

    wallet = data['wallet'].strip().lower()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()

    # Basic validation
    if not wallet.startswith('0x') or len(wallet) != 42:
        return jsonify({'error': 'Invalid wallet address'}), 400

    # Check if user already exists
    existing = User.query.filter_by(wallet=wallet).first()
    if existing:
        return jsonify({'error': 'Wallet already registered'}), 409

    # Create new user
    new_user = User(wallet=wallet, username=username or None, email=email or None)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'Registration successful', 'user': new_user.to_dict()}), 201

@app.route('/api/user/<wallet>', methods=['GET'])
def get_user(wallet):
    """Retrieve user info by wallet address"""
    wallet = wallet.strip().lower()
    user = User.query.filter_by(wallet=wallet).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())

@app.route('/api/nonce', methods=['GET'])
def get_nonce():
    """Generate a nonce for wallet signature (optional)"""
    # In a real implementation, you'd store this nonce temporarily
    import secrets
    nonce = secrets.token_hex(16)
    session['nonce'] = nonce
    return jsonify({'nonce': nonce})

if __name__ == '__main__':
    app.run(debug=True)
