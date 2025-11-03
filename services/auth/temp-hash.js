const bcrypt = require('bcryptjs');

const password = 'password123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('Generated hash:', hash);
  
  // Test the hash
  bcrypt.compare(password, hash, (err, result) => {
    if (err) {
      console.error('Compare error:', err);
      process.exit(1);
    }
    console.log('Hash matches:', result);
    console.log('\nSQL UPDATE command:');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE username IN ('admin', 'manager', 'operator');`);
  });
});
