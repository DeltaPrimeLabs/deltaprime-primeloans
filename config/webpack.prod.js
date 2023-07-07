const paths = require('./paths')
const { merge, mergeWithRules } = require('webpack-merge')
const common = require('./webpack.common.js')
const webpack = require('webpack')

const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')

const prodConfig = {
    mode: 'production',
    devtool: false,

    output: {
        path: paths.build,
        publicPath: '/',
        filename: 'js/[name].[contenthash].bundle.js',
    },


    // Production: Magic happen here transpiling to es5 to partly support older browser like IE11
    target: ['web', 'es5'],

    plugins: [
        new MiniCssExtractPlugin({
            filename: "[name].css",
            chunkFilename: "[id].css"
        }),

        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
            'process.env.NODE_DEBUG': JSON.stringify('false')
        })
    ],
    module: {
        rules: [
            {
                test: /\.(scss|css)$/,
                use: [
                    'style-loader',
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'postcss-loader',
                    'sass-loader',
                ],
            },
        ],
    },
    optimization: {
        minimize: true,
        minimizer: [new CssMinimizerPlugin(), "..."],
        // Once your build outputs multiple chunks, this option will ensure they share the webpack runtime
        // instead of having their own. This also helps with long-term caching, since the chunks will only
        // change when actual code changes, not the webpack runtime.
        runtimeChunk: {
            name: 'runtime',
        },
    },
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
    },
};

const mergedConfig = mergeWithRules({
    module: {
        rules: {
            test: 'match',
            use: 'replace',
        },
    },
})(common, prodConfig);

module.exports = mergedConfig;