/**
 * Génère les rapports HTML et CSV à partir des statistiques
 */

/**
 * Génère le rapport HTML
 * @param {Object} stats - Statistiques
 * @returns {string} Contenu HTML
 */
function generateHTML(stats) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .stat-box { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; border-radius: 4px; }
        .stat-value { font-size: 2em; font-weight: bold; color: #4CAF50; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; }
        .warning { background-color: #fff3cd; border-left-color: #ffc107; }
        .info { background-color: #d1ecf1; border-left-color: #17a2b8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Rapport de Monitoring DDShare</h1>
        <p><strong>Date du rapport:</strong> ${stats.report_date}</p>
        
        <h2>📈 Vue d'ensemble</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div class="stat-box">
                <div class="stat-value">${stats.total_users}</div>
                <div class="stat-label">Utilisateurs uniques</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${stats.total_shares}</div>
                <div class="stat-label">Total partages</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${stats.active_shares}</div>
                <div class="stat-label">Partages actifs</div>
            </div>
            <div class="stat-box warning">
                <div class="stat-value">${stats.temp_files_count}</div>
                <div class="stat-label">Fichiers temporaires non partagés</div>
            </div>
        </div>
        
        <h2>👥 Partages par utilisateur</h2>
        <table>
            <thead>
                <tr>
                    <th>Utilisateur (anonymisé)</th>
                    <th>Total partages</th>
                    <th>Partages actifs</th>
                </tr>
            </thead>
            <tbody>
${generateUserRows(stats.shares_by_user)}
            </tbody>
        </table>
        
        <h2>📁 Fichiers temporaires</h2>
        <div class="stat-box info">
            <p><strong>Nombre total:</strong> ${stats.temp_files_count}</p>
            <p><strong>Taille totale estimée:</strong> ${stats.total_temp_size_mb} MB</p>
        </div>
        
        <h3>Répartition par extension</h3>
        <table>
            <thead>
                <tr>
                    <th>Extension</th>
                    <th>Nombre</th>
                </tr>
            </thead>
            <tbody>
${generateExtensionRows(stats.temp_files_by_ext)}
            </tbody>
        </table>
        
        <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
            <em>Note: Les données personnelles (emails, noms d'utilisateurs, noms de fichiers) ont été anonymisées pour des raisons de confidentialité.</em>
        </p>
        <p style="color: #666; font-size: 0.9em;">
            <em>Pour plus de détails, consultez le fichier CSV joint.</em>
        </p>
    </div>
</body>
</html>
`;
  return html;
}

/**
 * Génère les lignes du tableau des utilisateurs
 */
function generateUserRows(sharesByUser) {
  const sorted = [...sharesByUser].sort((a, b) => b.share_count - a.share_count);
  const top20 = sorted.slice(0, 20);
  
  if (top20.length === 0) {
    return '<tr><td colspan="3" style="text-align: center; color: #999;">Aucun utilisateur</td></tr>';
  }
  
  return top20.map(user => `
                <tr>
                    <td>${user.anonymized_email}</td>
                    <td>${user.share_count}</td>
                    <td>${user.active_share_count}</td>
                </tr>
`).join('');
}

/**
 * Génère les lignes du tableau des extensions
 */
function generateExtensionRows(tempFilesByExt) {
  const sorted = Object.entries(tempFilesByExt).sort((a, b) => b[1] - a[1]);
  
  if (sorted.length === 0) {
    return '<tr><td colspan="2" style="text-align: center; color: #999;">Aucun fichier temporaire</td></tr>';
  }
  
  return sorted.map(([ext, count]) => `
                <tr>
                    <td>${ext === 'no-ext' ? '(sans extension)' : ext}</td>
                    <td>${count}</td>
                </tr>
`).join('');
}

/**
 * Génère le rapport CSV
 * @param {Object} stats - Statistiques
 * @returns {string} Contenu CSV
 */
function generateCSV(stats) {
  const lines = [];
  
  // En-tête
  lines.push('Type,Donnée,Valeur');
  
  // Statistiques générales
  lines.push(`Statistique,Total utilisateurs,${stats.total_users}`);
  lines.push(`Statistique,Total partages,${stats.total_shares}`);
  lines.push(`Statistique,Partages actifs,${stats.active_shares}`);
  lines.push(`Statistique,Fichiers temporaires,${stats.temp_files_count}`);
  lines.push(`Statistique,Taille totale temporaires (MB),${stats.total_temp_size_mb}`);
  
  // Ligne vide
  lines.push('');
  lines.push('PARTAGES PAR UTILISATEUR');
  lines.push('Email (anonymisé),Username (anonymisé),Total partages,Partages actifs');
  
  // Trier par nombre de partages décroissant
  const sortedShares = [...stats.shares_by_user].sort((a, b) => b.share_count - a.share_count);
  for (const userData of sortedShares) {
    lines.push([
      escapeCSV(userData.anonymized_email),
      escapeCSV(userData.anonymized_username),
      userData.share_count,
      userData.active_share_count
    ].join(','));
  }
  
  // Ligne vide
  lines.push('');
  lines.push('FICHIERS TEMPORAIRES');
  lines.push('Nom de fichier (anonymisé),Taille (bytes),Date');
  
  for (const tempFile of stats.temp_files) {
    lines.push([
      escapeCSV(tempFile.anonymized_filename),
      tempFile.size,
      escapeCSV(tempFile.date)
    ].join(','));
  }
  
  return lines.join('\n');
}

/**
 * Échappe les valeurs pour CSV
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

module.exports = {
  generateHTML,
  generateCSV
};

