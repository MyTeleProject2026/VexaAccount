package com.mytele.vexaaccount.android;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public final class MainActivity extends Activity {
    private WebView webView;
    private final Set<String> allowedHosts = new HashSet<>(Arrays.asList(
        Uri.parse(BuildConfig.WEB_APP_URL).getHost(),
        "api-vexaaccount.onrender.com"
    ));

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        createWebView();
        webView.loadUrl(startUrl());
    }

    private void createWebView() {
        webView = new WebView(this);
        setContentView(webView);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if ("https".equalsIgnoreCase(uri.getScheme()) && host != null && allowedHosts.contains(host)) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                if (request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() == 404) {
                    showLoadError("The VexaAccount service returned Not Found. Check the deployed application route and try again.");
                }
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, int errorCode, String description, String failingUrl) {
                if (request.isForMainFrame()) showLoadError("Unable to load the VexaAccount service: " + description);
            }
        });
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setSupportMultipleWindows(false);
        webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        webView.getSettings().setUserAgentString(webView.getSettings().getUserAgentString() + " VexaAccountAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
    }

    private String startUrl() {
        String configured = BuildConfig.WEB_APP_URL == null ? "" : BuildConfig.WEB_APP_URL.trim();
        return configured.endsWith("/") ? configured : configured + "/";
    }

    private void showLoadError(String message) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        int p = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(p, p, p, p);
        layout.setBackgroundColor(Color.rgb(5, 8, 17));

        TextView title = new TextView(this);
        title.setText(getString(R.string.app_name));
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);

        TextView detail = new TextView(this);
        detail.setText("\n" + message + "\n\nURL: " + BuildConfig.WEB_APP_URL);
        detail.setTextColor(Color.LTGRAY);
        detail.setTextSize(15);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setOnClickListener(v -> {
            createWebView();
            webView.loadUrl(startUrl());
        });

        layout.addView(title);
        layout.addView(detail);
        layout.addView(retry);
        setContentView(layout);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
