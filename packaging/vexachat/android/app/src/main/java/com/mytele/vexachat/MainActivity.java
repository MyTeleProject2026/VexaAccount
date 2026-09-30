package com.mytele.vexachat;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.PermissionRequest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebSettings;
import android.widget.Toast;
import android.net.Uri;
import android.content.Intent;

public class MainActivity extends Activity {
    private WebView webView;

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
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                String appHost = Uri.parse(BuildConfig.VEXACHAT_WEB_URL).getHost();
                if (host != null && (host.equals(appHost) || host.endsWith(".onrender.com") || host.equals("api-vexaaccount.onrender.com"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
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
        webView.loadUrl(BuildConfig.VEXACHAT_WEB_URL);
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
