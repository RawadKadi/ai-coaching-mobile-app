const fs = require('fs');
const path = require('path');

const quotes = [
  "Day 0 is just the beginning. Let's lay the foundation today.",
  "Every journey begins with a single step. You are on the board!",
  "Two days in a row is a pattern. Keep moving forward.",
  "Three days is a trend. You're building real momentum now.",
  "Four days of commitment. The habits are starting to take root.",
  "Five days strong! Consistency is the separator.",
  "Six days of focus. You are proving it to yourself every day.",
  "One week down! Seven days of perfect execution. Level up!",
  "Day eight. New week, same relentless dedication.",
  "Nine days. The compound effect is starting to work in your favor.",
  "Double digits! 10 days of showing up and putting in the work.",
  "Day 11. Refuse to negotiate with your weaknesses.",
  "Day 12. Greatness is found in the daily grind.",
  "Day 13. Unlucky for some, unstoppable for you.",
  "Two weeks solid! 14 days of discipline over motivation.",
  "Day 15. Halfway to a month of absolute dedication.",
  "Day 16. The hardest part is starting. You're well past that.",
  "Day 17. Your future self is thanking you right now.",
  "Day 18. Build a wall of consistency, brick by brick.",
  "Day 19. Fuel your progress with relentless action.",
  "Three weeks check! 20 days of setting the standard.",
  "Day 21. Three weeks completed. This is officially a habit.",
  "Day 22. Don't stop when it's hard, stop when you're done.",
  "Day 23. Energy flows where focus goes. Stay locked in.",
  "Day 24. Another day, another stack of wins.",
  "Day 25. A quarter of a century! 25 days of pure drive.",
  "Day 26. Master your day, master your life.",
  "Day 27. The bridge between goals and success is discipline.",
  "Day 28. Four weeks of absolute domination.",
  "Day 29. Momentum is your superpower. Protect it at all costs.",
  "One month clear! 30 days of standard-setting consistency.",
  "Day 31. New month, same mission. Push the pace.",
  "Day 32. Ordinary efforts yield ordinary results. Be extraordinary.",
  "Day 33. Three is a crowd, thirty-three is a powerhouse.",
  "Day 34. Stay hungry, stay humble, stay consistent.",
  "Day 35. Five weeks of setting the bar higher.",
  "Day 36. Success is the sum of small details done right daily.",
  "Day 37. You don't have to be perfect, you just have to be relentless.",
  "Day 38. Crush the day before it crushes your goals.",
  "Day 39. Consistency is the ultimate flex.",
  "Day 40. Forty days of focus. You are reshaping your habits.",
  "Day 41. Keep the chain unbroken. Your streak is your shield.",
  "Day 42. Six weeks of dedication. No excuses, just results.",
  "Day 43. Rise above the noise and execute.",
  "Day 44. Double fours, double the drive. Keep pressing.",
  "Day 45. Forty-five days. You're officially in the elite bracket.",
  "Day 46. Let your results do the talking.",
  "Day 47. You are stronger than your strongest excuse.",
  "Day 48. Focus on the process, the progress will follow.",
  "Day 49. Seven weeks of stackable wins. Seven days a week.",
  "Halfway to a hundred! 50 days of unmatched momentum.",
  "Day 51. The second half of the century starts today.",
  "Day 52. Action cures fear. Keep executing.",
  "Day 53. Silence the doubters with your consistency.",
  "Day 54. Be the hammer, not the nail.",
  "Day 55. Double nickels. High speed, no limits.",
  "Day 56. Eight weeks of building an unbreakable mindset.",
  "Day 57. You are carving out a new identity daily.",
  "Day 58. Hard work beats talent when talent doesn't work hard.",
  "Day 59. One day away from sixty. Stay hungry.",
  "Two months complete! 60 days of relentless progress.",
  "Day 61. Your momentum is a freight train. Keep rolling.",
  "Day 62. Excellence is not an act, it is a habit.",
  "Day 63. Stay true to the work when nobody is watching.",
  "Day 64. Build your legacy in silence.",
  "Day 65. Sixty-five days of stacking the deck in your favor.",
  "Day 66. Route 66. Cruising with absolute power.",
  "Day 67. The only bad workout is the one that didn't happen.",
  "Day 68. Keep pushing the boundaries of what you thought possible.",
  "Day 69. Sixty-nine days of elite execution. Nice work.",
  "Day 70. Ten weeks of standard-setting consistency.",
  "Day 71. The standard is the standard. Don't compromise.",
  "Day 72. Elevate your mind, elevate your results.",
  "Day 73. There are no shortcuts to any place worth going.",
  "Day 74. Consistency is where the magic happens.",
  "Day 75. Three quarters of a century! 75 days of pure drive.",
  "Day 76. Sweat equity pays the highest dividends.",
  "Day 77. Double sevens. Lucky and legendary. Keep it up.",
  "Day 78. Small daily improvements lead to massive results.",
  "Day 79. One day away from eighty. Stay locked in.",
  "Day 80. Eighty days of absolute execution.",
  "Day 81. Win the morning, win the day.",
  "Day 82. Push through the plateau. Progress is waiting.",
  "Day 83. The only limit is the one you set in your mind.",
  "Day 84. Twelve weeks of pure, unadulterated discipline.",
  "Day 85. Eighty-five days of stackable wins.",
  "Day 86. Make consistency your signature style.",
  "Day 87. You are in the zone. Don't blink.",
  "Day 88. Infinite potential, infinite drive. Stay focused.",
  "Day 89. One day away from ninety. Finish the week strong.",
  "Day 90. Ninety days. Three months of standard setting.",
  "Day 91. Don't count the days, make the days count.",
  "Day 92. Champion mindset: finding a way when there is no way.",
  "Day 93. You didn't come this far to only come this far.",
  "Day 94. The pain of discipline is nothing compared to regret.",
  "Day 95. Ninety-five days of building a monument of success.",
  "Day 96. Stay patient, trust the grind.",
  "Day 97. You are rewriting your genetic potential.",
  "Day 98. Almost at the summit. Stay sharp.",
  "Day 99. The ultimate threshold. Ninety-nine days of execution.",
  "CENTURY CLUB! 100 days of absolute domination. Unbelievable!"
];

const colors = [
  { accent: '#64748B', emoji: '🌱', title: 'Seedling', grad: ['#0f172a', '#1e293b'] },
  { accent: '#3B82F6', emoji: '⚡️', title: 'Spark', grad: ['#020617', '#1e3a8a'] },
  { accent: '#10B981', emoji: '🔥', title: 'Ignition', grad: ['#020617', '#064e3b'] },
  { accent: '#F59E0B', emoji: '🚀', title: 'Lift Off', grad: ['#020617', '#78350f'] },
  { accent: '#8B5CF6', emoji: '👑', title: 'Apex', grad: ['#020617', '#4c1d95'] },
  { accent: '#EC4899', emoji: '💪', title: 'Warrior', grad: ['#020617', '#831843'] },
  { accent: '#F97316', emoji: '🏆', title: 'Champion', grad: ['#020617', '#7c2d12'] },
  { accent: '#14B8A6', emoji: '🎯', title: 'Marksman', grad: ['#020617', '#115e59'] },
  { accent: '#06B6D4', emoji: '💎', title: 'Diamond', grad: ['#020617', '#164e63'] },
  { accent: '#F43F5E', emoji: '🌋', title: 'Volcanic', grad: ['#020617', '#881337'] }
];

const data = [];
for (let i = 0; i <= 100; i++) {
  const quote = quotes[i] || `Day ${i} of absolute consistency. Keep stackin' those daily wins!`;
  
  // Day 0 gets first theme
  // Day 100 gets special gold theme
  let theme;
  if (i === 0) {
    theme = colors[0];
  } else if (i === 100) {
    theme = { accent: '#D4AF37', emoji: '👑', title: 'Immortal', grad: ['#020617', '#5f4d12'] };
  } else {
    // Distribute remaining colors
    const idx = ((i - 1) % (colors.length - 1)) + 1; // avoids index 0 (Seedling) for general rotation
    theme = colors[idx];
  }
  
  // Custom titles for key milestones
  let title = theme.title;
  if (i === 7) title = 'Week One';
  else if (i === 10) title = 'Decade';
  else if (i === 14) title = 'Fortnight';
  else if (i === 21) title = 'Habitual';
  else if (i === 30) title = 'One Month';
  else if (i === 50) title = 'Half Century';
  else if (i === 60) title = 'Two Months';
  else if (i === 75) title = 'Quarter Centurion';
  else if (i === 90) title = 'Quarter Year';
  else if (i === 100) title = 'Centurion';

  data.push({
    day: i,
    quote: quote,
    accent: theme.accent,
    emoji: theme.emoji,
    title: title,
    grad: theme.grad
  });
}

const outputPath = path.join(__dirname, '../assets/streak_quotes.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully wrote streak_quotes.json to:', outputPath);
