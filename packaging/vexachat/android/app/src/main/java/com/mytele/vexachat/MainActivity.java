package com.mytele.vexachat;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceError;
import android.webkit.PermissionRequest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebSettings;
import android.widget.Toast;
import android.net.Uri;
import android.content.Intent;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Button;

public class MainActivity extends Activity {
    private WebView webView;
    private LinearLayout offlineView;
    private final Handler startupHandler = new Handler(Looper.getMainLooper());
    private boolean pageFinished = false;
    private boolean startupFailureShown = false;
    private final Runnable startupWatchdog = new Runnable() {
        @Override public void run() {
            if (startupFailureShown || webView == null) return;
            webView.evaluateJavascript(
                "(function(){var t=(document.body&&document.body.innerText)||'';return JSON.stringify({title:document.title||'',text:t.slice(0,500),ready:document.readyState,splash:t.indexOf('Starting secure messenger')>=0});})()",
                value -> {
                    if (startupFailureShown) return;
                    if (!pageFinished || value.contains("\"splash\":true")) {
                        showStartupFailure(value);
                    }
                }
            );
        }
    };


    private void showOffline() {
        showOffline("You're offline\n\nCheck your internet connection and try again.");
    }

    private void showOffline(String messageText) {
        if (offlineView != null) return;
        offlineView = new LinearLayout(this);
        offlineView.setOrientation(LinearLayout.VERTICAL);
        offlineView.setGravity(Gravity.CENTER);
        offlineView.setPadding(36, 36, 36, 36);
        offlineView.setBackgroundColor(Color.rgb(6,16,29));

        ImageView logo = new ImageView(this);
        logo.setImageResource(com.mytele.vexachat.R.drawable.ic_vexachat_launcher);
        offlineView.addView(logo, new LinearLayout.LayoutParams(180,180));

        TextView title = new TextView(this);
        title.setText("VexaChat");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, 1);
        offlineView.addView(title, new LinearLayout.LayoutParams(-1,-2));

        TextView message = new TextView(this);
        message.setText(messageText);
        message.setTextColor(Color.rgb(143,164,189));
        message.setTextSize(15);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(-1,-2);
        mp.topMargin = 18;
        offlineView.addView(message, mp);

        Button retry = new Button(this);
        retry.setText("TRY AGAIN");
        retry.setTextColor(Color.WHITE);
        retry.setOnClickListener(v -> {
            offlineView = null;
            startupFailureShown = false;
            pageFinished = false;
            setContentView(webView);
            startupHandler.removeCallbacks(startupWatchdog);
            startupHandler.postDelayed(startupWatchdog, 20000);
            webView.reload();
        });
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-2,-2);
        bp.topMargin = 20;
        offlineView.addView(retry, bp);
        setContentView(offlineView);
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " VexaChatAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                    (checkSelfPermission("android.permission.CAMERA") != PackageManager.PERMISSION_GRANTED ||
                     checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED)) {
                    runOnUiThread(() -> requestPermissions(new String[]{"android.permission.CAMERA", "android.permission.RECORD_AUDIO"}, 4101));
                    return;
                }
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pageFinished = false;
                startupFailureShown = false;
                startupHandler.removeCallbacks(startupWatchdog);
                startupHandler.postDelayed(startupWatchdog, 20000);
            }

            @Override public void onPageFinished(WebView view, String url) {
                pageFinished = true;
                startupHandler.removeCallbacks(startupWatchdog);
                startupHandler.postDelayed(startupWatchdog, 5000);
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                String appHost = Uri.parse(BuildConfig.VEXACHAT_WEB_URL).getHost();
                if (host != null && (host.equals(appHost) || host.endsWith(".onrender.com") || host.equals("api-vexaaccount.onrender.com"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
                if (request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 500) {
                    showStartupFailure("HTTP " + errorResponse.getStatusCode());
                }
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) runOnUiThread(() -> showStartupFailure(String.valueOf(error.getDescription())));
            }
        });
        webView.setDownloadListener((url,userAgent,contentDisposition,mimeType,contentLength)->{
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch(Exception e){ Toast.makeText(this,"Unable to open download",Toast.LENGTH_SHORT).show(); }
        });
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            (checkSelfPermission("android.permission.CAMERA") != PackageManager.PERMISSION_GRANTED ||
             checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED)) {
            requestPermissions(new String[]{"android.permission.CAMERA", "android.permission.RECORD_AUDIO"}, 4101);
        }
        startupHandler.postDelayed(startupWatchdog, 20000);
        webView.loadUrl(BuildConfig.VEXACHAT_WEB_URL);
    }

    private void showStartupFailure(String diagnostics) {
        if (startupFailureShown) return;
        startupFailureShown = true;
        startupHandler.removeCallbacks(startupWatchdog);
        if (webView != null) webView.stopLoading();
        runOnUiThread(() -> showOffline("VexaChat could not finish starting.\n\nPlease check your connection and try again.\n\nStartup: " + diagnostics));
    }

    @Override protected void onDestroy() {
        startupHandler.removeCallbacks(startupWatchdog);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}