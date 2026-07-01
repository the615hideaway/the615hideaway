(function initArtistDjRequestsPage() {
  const exampleHost = document.getElementById('dj-request-example');
  const fromEmailEl = document.getElementById('dj-request-from-email');
  const namingEl = document.getElementById('dj-request-naming-example');

  const fromEmail = CONFIG.wavRequest?.fromEmail || 'radio@the615hideaway.com';
  const namingExample = CONFIG.wavNamingExample || 'Song Title - Artist Name.wav';

  if (fromEmailEl) fromEmailEl.textContent = fromEmail;
  if (namingEl) namingEl.textContent = namingExample;

  if (exampleHost) {
    exampleHost.innerHTML = `
      <p class="artist-dj-request-example-from"><strong>From:</strong> Radio Now — (615) Hideaway Entertainment &lt;${Utils.escapeHtml(fromEmail)}&gt;</p>
      <p class="artist-dj-request-example-subject"><strong>Subject:</strong> DJ requests WAV for your song — Old Blind Gentleman — David Parmley</p>
      <div class="artist-dj-request-example-body">
        <p><strong>WAV request from a Radio Now DJ</strong></p>
        <p>A Radio Now DJ is requesting a broadcast WAV file for airplay.</p>
        <ul>
          <li><strong>Song:</strong> Old Blind Gentleman</li>
          <li><strong>Artist:</strong> David Parmley</li>
          <li><strong>Label:</strong> 615 Hideaway Records</li>
          <li><strong>DJ name:</strong> Sammy Passamano</li>
          <li><strong>Station:</strong> 615</li>
          <li><strong>Show:</strong> Bluegrass Hideaway</li>
          <li><strong>DJ email:</strong> dj@station.com</li>
        </ul>
        <p>Please reply with the WAV file or a download link when you can.</p>
      </div>
      <p class="artist-dj-request-example-tip"><i class="fa-solid fa-reply"></i> Tap <strong>Reply</strong> in your email app — your answer goes to the DJ email shown above.</p>`;
  }

  ArtistPortalAuth.initPage({ activeNav: 'djRequests' });
})();