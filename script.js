// Website Contact Scraper - Frontend Script

/**
 * Main application controller
 */
class ScrapeController {
  /**
   * Initialize the application
   */
  constructor() {
    // DOM elements
    this.urlInput = document.getElementById('urlInput');
    this.scrapeButton = document.getElementById('scrapeButton');
    this.progressSection = document.getElementById('progressSection');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.resultsSection = document.getElementById('resultsSection');
    this.resultsBody = document.getElementById('resultsBody');
    this.successCount = document.getElementById('successCount');
    this.errorCount = document.getElementById('errorCount');
    this.emailCount = document.getElementById('emailCount');
    
    // Application state
    this.currentJobId = null;
    this.pollingInterval = null;
    
    // Bind event listeners
    this.scrapeButton.addEventListener('click', this.startScraping.bind(this));
  }
  
  /**
   * Parse URLs from input field
   * @returns {string[]} Array of URLs
   */
  parseUrls() {
    const input = this.urlInput.value.trim();
    if (!input) return [];
    
    return input.split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }
  
  /**
   * Start the scraping process
   */
  async startScraping() {
    const urls = this.parseUrls();
    
    if (urls.length === 0) {
      alert('Please enter at least one URL');
      return;
    }
    
    // Update UI for scraping process
    this.scrapeButton.disabled = true;
    this.progressSection.classList.remove('hidden');
    this.resultsSection.classList.remove('hidden');
    this.resultsBody.innerHTML = '';
    this.progressBar.value = 0;
    this.progressBar.max = urls.length;
    this.progressText.textContent = `0/${urls.length} URLs processed`;
    
    try {
      // Send scraping request to server
      const response = await fetch('/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      this.currentJobId = data.jobId;
      
      // Start polling for updates
      this.startPolling();
    } catch (error) {
      alert(`Error starting scrape job: ${error.message}`);
      this.scrapeButton.disabled = false;
    }
  }
  
  /**
   * Start polling for job status updates
   */
  startPolling() {
    // Clear any existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Poll every second
    this.pollingInterval = setInterval(async () => {
      try {
        await this.updateJobStatus();
      } catch (error) {
        console.error('Polling error:', error);
        this.stopPolling();
        alert(`Error checking job status: ${error.message}`);
        this.scrapeButton.disabled = false;
      }
    }, 1000);
  }
  
  /**
   * Stop polling for updates
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  /**
   * Update the job status from the server
   */
  async updateJobStatus() {
    if (!this.currentJobId) return;
    
    const response = await fetch(`/status?jobId=${this.currentJobId}`);
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update progress
    this.progressBar.value = data.processed;
    this.progressText.textContent = `${data.processed}/${data.total} URLs processed`;
    
    // Update results table
    this.updateResultsTable(data.results);
    
    // If job is complete, stop polling
    if (data.status === 'completed') {
      this.stopPolling();
      this.scrapeButton.disabled = false;
      this.currentJobId = null;
    }
  }
  
  /**
   * Update the results table with current data
   * @param {Array} results - Array of result objects
   */
  updateResultsTable(results) {
    // Clear existing rows if needed
    if (this.resultsBody.children.length === 0) {
      this.resultsBody.innerHTML = '';
    }
    
    // Update or add rows for each result
    let successCount = 0;
    let errorCount = 0;
    let totalEmails = 0;
    
    results.forEach((result, index) => {
      let row = this.resultsBody.querySelector(`[data-url="${result.url}"]`);
      
      if (!row) {
        row = document.createElement('tr');
        row.setAttribute('data-url', result.url);
        this.resultsBody.appendChild(row);
      }
      
      // Count statistics
      if (result.status === 'success') {
        successCount++;
        totalEmails += (result.emails?.length || 0);
      } else if (result.status === 'error') {
        errorCount++;
      }
      
      // Create row content
      let statusClass = '';
      let statusText = 'Pending';
      let resultContent = '';
      
      if (result.status === 'success') {
        statusClass = 'success';
        statusText = 'Success';
        
        if (result.emails && result.emails.length > 0) {
          resultContent = '<ul class="email-list">' + 
            result.emails.map(email => `<li>${email}</li>`).join('') + 
            '</ul>';
        } else {
          resultContent = 'No emails found';
        }
      } else if (result.status === 'error') {
        statusClass = 'error';
        statusText = 'Error';
        resultContent = result.error || 'Unknown error';
      }
      
      row.innerHTML = `
        <td>${result.url}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${resultContent}</td>
      `;
    });
    
    // Update summary counts
    this.successCount.textContent = `${successCount} successful`;
    this.errorCount.textContent = `${errorCount} errors`;
    this.emailCount.textContent = `${totalEmails} emails found`;
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ScrapeController();
}); 