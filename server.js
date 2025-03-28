// Website Contact Scraper - Backend Server
// This server handles scraping requests and serves the frontend

import { serve } from "https://deno.land/std/http/server.ts";
import { NAMESPACE_URL } from "jsr:@std/uuid/constants";
import { generate, validate } from "jsr:@std/uuid/v5";

// Store for active scraping jobs
const jobs = new Map();


/**
 * Extracts email addresses from HTML content
 * @param {string} htmlContent - The HTML content to search
 * @returns {string[]} - Array of found email addresses
 */
function extractEmails(htmlContent) {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  return [...new Set(htmlContent.match(emailRegex) || [])]; // Use Set to remove duplicates
}

/**
 * Validates a URL string
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Processes a list of URLs to extract emails
 * @param {string[]} urls - Array of URLs to process
 * @param {string} jobId - Unique job identifier
 */
async function processUrls(urls, jobId) {
  const job = jobs.get(jobId);
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    const resultEntry = { url, status: "pending" };
    job.results.push(resultEntry);
    
    // Validate URL
    if (!isValidUrl(url)) {
      resultEntry.status = "error";
      resultEntry.error = "Invalid URL format";
      job.processed++;
      continue;
    }
    
    try {
      // Fetch the website content
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const htmlContent = await response.text();
      const emails = extractEmails(htmlContent);
      
      resultEntry.status = "success";
      resultEntry.emails = emails;
    } catch (error) {
      resultEntry.status = "error";
      resultEntry.error = `Error: ${error.message}`;
    }
    
    job.processed++;
    
    // Add delay between requests to avoid overwhelming websites
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  job.status = "completed";
}

/**
 * Handles HTTP requests
 * @param {Request} req - The HTTP request
 * @returns {Response} - The HTTP response
 */
async function handler(req) {
  const url = new URL(req.url);
  
  // CORS headers for all responses
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  
  // Handle OPTIONS requests (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  
  // Serve static files for frontend
  if (req.method === "GET" && url.pathname === "/") {
    try {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { 
        headers: { ...headers, "Content-Type": "text/html" } 
      });
    } catch (e) {
      return new Response("Frontend files not found", { status: 404, headers });
    }
  }
  
  if (req.method === "GET" && url.pathname === "/style.css") {
    try {
      const css = await Deno.readTextFile("./style.css");
      return new Response(css, { 
        headers: { ...headers, "Content-Type": "text/css" } 
      });
    } catch (e) {
      return new Response("CSS file not found", { status: 404, headers });
    }
  }
  
  if (req.method === "GET" && url.pathname === "/script.js") {
    try {
      const js = await Deno.readTextFile("./script.js");
      return new Response(js, { 
        headers: { ...headers, "Content-Type": "application/javascript" } 
      });
    } catch (e) {
      return new Response("JavaScript file not found", { status: 404, headers });
    }
  }
  
  // API endpoint to start a scraping job
  if (req.method === "POST" && url.pathname === "/scrape") {
    try {
      const body = await req.json();
      
      if (!body.urls || !Array.isArray(body.urls)) {
        return new Response(JSON.stringify({ error: "Invalid request: urls array is required" }), { 
          status: 400, 
          headers: { ...headers, "Content-Type": "application/json" } 
        });
      }
      
      const data = new TextEncoder().encode("example.com");
      const jobId = await generate(NAMESPACE_URL, data);
      const job = {
        id: jobId,
        urls: body.urls,
        status: "processing",
        processed: 0,
        total: body.urls.length,
        results: []
      };
      
      jobs.set(jobId, job);
      
      // Start processing URLs in the background
      processUrls(body.urls, jobId);
      
      return new Response(JSON.stringify({ jobId }), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
        status: 400, 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }
  }
  
  // API endpoint to check job status
  if (req.method === "GET" && url.pathname === "/status") {
    const jobId = url.searchParams.get("jobId");
    
    if (!jobId || !jobs.has(jobId)) {
      return new Response(JSON.stringify({ error: "Job not found" }), { 
        status: 404, 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }
    
    const job = jobs.get(jobId);
    
    // Clean up completed jobs after 5 minutes
    if (job.status === "completed") {
      setTimeout(() => {
        jobs.delete(jobId);
      }, 5 * 60 * 1000);
    }
    
    return new Response(JSON.stringify({
      status: job.status,
      processed: job.processed,
      total: job.total,
      results: job.results
    }), { 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
  
  // Handle 404 for any other routes
  return new Response("Not Found", { status: 404, headers });
}

// Start the server
console.log("Starting Website Contact Scraper server on http://localhost:8000");
await serve(handler, { port: 8000 }); 