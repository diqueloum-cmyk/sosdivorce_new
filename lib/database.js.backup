// Base de données simple pour les utilisateurs
// Utilise la mémoire Vercel pour stocker les données

let users = [];

// Fonction pour ajouter un utilisateur
export function addUser(userData) {
  const user = {
    id: Date.now().toString(),
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    registeredAt: new Date().toISOString(),
    source: 'sosdivorce.fr'
  };
  
  users.push(user);
  console.log('Utilisateur ajouté:', user);
  return user;
}

// Fonction pour récupérer tous les utilisateurs
export function getAllUsers() {
  return users;
}

// Fonction pour trouver un utilisateur par email
export function findUserByEmail(email) {
  return users.find(user => user.email === email);
}

// Fonction pour obtenir le nombre total d'utilisateurs
export function getUserCount() {
  return users.length;
}

// Fonction pour obtenir les statistiques
export function getStats() {
  const totalUsers = users.length;
  const today = new Date().toISOString().split('T')[0];
  const todayUsers = users.filter(user => 
    user.registeredAt.split('T')[0] === today
  ).length;
  
  return {
    totalUsers,
    todayUsers,
    lastUser: users[users.length - 1] || null
  };
}
